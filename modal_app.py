"""
Modal fine-tuning backend for Llama 3.2 1B.
Pipeline: JSON dataset → LoRA fine-tune → merge weights → Q4_K_M GGUF

Usage (CLI):
    modal run finetune.py --dataset your_data.json

Usage (HTTP):
    curl -X POST https://<your-modal-app>.modal.run/finetune \
         -H "Content-Type: application/json" \
         -d @your_dataset.json

Dataset format (Custom):
    [{"prompt": "...", "response": "..."}, ...]

Dataset format (Open-Source):
    {"dataset_name": "cybersec"}

Output:
    GGUF saved to Modal Volume 'finetune-vol' at /output/model-q4_k_m.gguf
    Download with:
        modal volume get finetune-vol /output/model-q4_k_m.gguf ./model-q4_k_m.gguf

Prerequisites:
    modal secret create huggingface-secret HF_TOKEN=hf_xxxxx
"""

import json
import os
import subprocess
from pathlib import Path

import modal
from fastapi import Body  # <-- 1. Ajoute cet import

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_MODEL = "meta-llama/Llama-3.2-1B-Instruct"

# Ephemeral container paths
DATASET_PATH  = "/tmp/dataset.json"
RECIPE_PATH   = "/tmp/lora_finetune.yaml"
BASE_DIR      = "/tmp/base_model"
TOKENIZER_DIR = "/tmp/tokenizer"
ADAPTER_DIR   = "/tmp/adapter"
MERGED_DIR    = "/tmp/merged_model"
LLAMA_CPP_DIR = "/llama.cpp"       # prebuilt in ghcr.io/ggerganov/llama.cpp:full

# Persistent path on Modal Volume
GGUF_VOLUME_PATH = "/output/model-q4_k_m.gguf"

# Training hyperparams
GPU        = "A10G"
LORA_RANK  = 16
BATCH_SIZE = 4
MAX_STEPS  = 50   # raise for larger datasets
LR         = 3e-4

# ---------------------------------------------------------------------------
# Supported Open-Source Datasets
# ---------------------------------------------------------------------------
SUPPORTED_DATASETS = {
    "cybersec": {
        "repo_id": "AlicanKiraz0/Cybersecurity-Dataset-Heimdall-v1.1", # Cyber-défense très quali (plus de 20k instructions)
        "prompt_col": "user",
        "response_col": "assistant"
    },
    "hackmentor": {
        "repo_id": "primeai7460/hackmentor-instruction", # Axé pentest et sécurité réseau
        "prompt_col": "instruction",
        "response_col": "output"
    },
    "alpaca": {
        "repo_id": "yahma/alpaca-cleaned",
        "prompt_col": "instruction",
        "response_col": "output"
    },
    "python": {
        "repo_id": "iamtarun/python_code_instructions_18k_alpaca",
        "prompt_col": "instruction",
        "response_col": "output"
    }
}

# ---------------------------------------------------------------------------
# Container image
# ---------------------------------------------------------------------------

image = (
    modal.Image.from_registry(
        "ghcr.io/ggml-org/llama.cpp:full-cuda",
        add_python="3.11",
    )
    .entrypoint([])
    .pip_install(
        "torch==2.5.1",
        extra_options="--index-url https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "fastapi[standard]",
        "torchtune==0.4.0",
        "torchao==0.7.0",
        "transformers>=4.43.0",
        "datasets",
        "huggingface_hub",
        "sentencepiece",
        "peft",
        "accelerate",
        "bitsandbytes",
    )
)

app = modal.App("llama32-gguf-finetune", image=image)
vol = modal.Volume.from_name("finetune-vol", create_if_missing=True)


# ---------------------------------------------------------------------------
# Helper: torchtune YAML config
# ---------------------------------------------------------------------------

def build_torchtune_config(dataset_path: str, adapter_out: str) -> str:
    return f"""
model:
  _component_: torchtune.models.llama3_2.lora_llama3_2_1b
  lora_attn_modules: ['q_proj', 'v_proj', 'k_proj', 'output_proj']
  apply_lora_to_mlp: true
  lora_rank: {LORA_RANK}
  lora_alpha: {LORA_RANK * 2}

tokenizer:
  _component_: torchtune.models.llama3.llama3_tokenizer
  path: {BASE_DIR}/original/tokenizer.model
  max_seq_len: 2048

dataset:
  _component_: torchtune.datasets.instruct_dataset
  source: json
  data_files: {dataset_path}
  column_map:
    input: prompt
    output: response
  train_on_input: false
  split: train

checkpointer:
  _component_: torchtune.training.FullModelHFCheckpointer
  checkpoint_dir: {BASE_DIR}
  checkpoint_files:
    - model.safetensors
  recipe_checkpoint: null
  output_dir: {adapter_out}
  model_type: LLAMA3

metric_logger:
  _component_: torchtune.training.metric_logging.DiskLogger
  log_dir: {adapter_out}/logs

output_dir: {adapter_out}

optimizer:
  _component_: torch.optim.AdamW
  lr: {LR}
  weight_decay: 0.01

lr_scheduler:
  _component_: torchtune.training.lr_schedulers.get_cosine_schedule_with_warmup
  num_warmup_steps: 20

loss:
  _component_: torch.nn.CrossEntropyLoss

batch_size: {BATCH_SIZE}
epochs: 1
max_steps_per_epoch: {MAX_STEPS}
gradient_accumulation_steps: 4
compile: false
resume_from_checkpoint: false
shuffle: true

device: cuda
dtype: bf16

seed: 42
log_every_n_steps: 10
"""


# ---------------------------------------------------------------------------
# Helper: prepare dataset (Custom JSON or HuggingFace Open Source)
# ---------------------------------------------------------------------------

def prepare_dataset(input_data: dict | list) -> int:
    """
    Traite soit un JSON custom (liste), soit un nom de dataset (dict).
    Filtre les valeurs vides (None) et sauvegarde le résultat dans DATASET_PATH.
    Retourne le nombre de records valides.
    """
    records = []

    if isinstance(input_data, dict) and "dataset_name" in input_data:
        name = input_data["dataset_name"]
        if name not in SUPPORTED_DATASETS:
            raise ValueError(f"Dataset inconnu: '{name}'. Supportés: {list(SUPPORTED_DATASETS.keys())}")
        
        print(f"[dataset] Téléchargement du dataset open-source : {name} ...")
        from datasets import load_dataset
        
        info = SUPPORTED_DATASETS[name]
        hf_data = load_dataset(info["repo_id"], split="train")
        
        for row in hf_data:
            p = row.get(info["prompt_col"])
            r = row.get(info["response_col"])
            # Filtre de sécurité : on s'assure que le texte existe et n'est pas vide
            if p and r and isinstance(p, str) and isinstance(r, str):
                records.append({
                    "prompt": p.strip(),
                    "response": r.strip()
                })
                
    elif isinstance(input_data, list):
        for i, rec in enumerate(input_data):
            p = rec.get("prompt")
            r = rec.get("response")
            if p and r and isinstance(p, str) and isinstance(r, str):
                records.append({
                    "prompt": p.strip(),
                    "response": r.strip()
                })
            else:
                print(f"[dataset] Attention : Ligne {i} ignorée car invalide ou vide.")
        
    else:
        raise ValueError("Input invalide. Fournissez une liste d'objets ou {'dataset_name': 'nom'}.")

    with open(DATASET_PATH, "w") as f:
        json.dump(records, f)
    
    print(f"[dataset] {len(records)} records valides prêts → {DATASET_PATH}")
    return len(records)


# ---------------------------------------------------------------------------
# Helper: run shell command, raise on failure
# ---------------------------------------------------------------------------

def run(cmd: list[str], label: str) -> None:
    print(f"[{label}] {' '.join(cmd)}")
    result = subprocess.run(cmd, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"[{label}] failed with exit code {result.returncode}")


# ---------------------------------------------------------------------------
# Core pipeline:  fine-tune → merge → GGUF Q4_K_M
# ---------------------------------------------------------------------------

@app.function(
    gpu=GPU,
    timeout=60 * 60 * 4,          # 4 hours: fine-tune + merge + quantize
    volumes={"/output": vol},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    cpu=4,
    memory=32768,
)
def finetune_and_quantize(dataset: dict | list) -> dict:
    """
    Runs the full pipeline on a GPU container:
      Step 1 — Download Llama 3.2 1B base weights from HuggingFace
      Step 2 — Fine-tune with LoRA via torchtune
      Step 3 — Merge LoRA adapter into full model weights (PEFT)
      Step 4 — Convert merged HF model → F16 GGUF  (llama.cpp)
      Step 5 — Quantize F16 GGUF → Q4_K_M GGUF     (llama.cpp)
      Step 6 — Persist final GGUF to Modal Volume
    """
    import shutil

    import torch
    from huggingface_hub import snapshot_download
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    print(f"[info] GPU  : {torch.cuda.get_device_name(0)}")
    print(f"[info] Steps: 6")

    # ------------------------------------------------------------------
    # Step 1 — Prepare dataset
    # ------------------------------------------------------------------
    num_records = prepare_dataset(dataset)

    # ------------------------------------------------------------------
    # Step 2 — Download base model + tokenizer
    # ------------------------------------------------------------------
    hf_token = os.environ.get("HF_TOKEN")
    print(f"\n[1/5] Downloading {BASE_MODEL} ...")
    snapshot_download(
        repo_id=BASE_MODEL,
        local_dir=BASE_DIR,
        token=hf_token,
        ignore_patterns=["*.msgpack", "*.h5", "flax_*"],
    )
    snapshot_download(
        repo_id=BASE_MODEL,
        local_dir=TOKENIZER_DIR,
        token=hf_token,
        allow_patterns=["tokenizer*", "special_tokens_map.json"],
    )
    print("[1/5] Download complete.")

    # ------------------------------------------------------------------
    # Step 3 — LoRA fine-tuning (torchtune)
    # ------------------------------------------------------------------
    print("\n[2/5] Fine-tuning with LoRA ...")
    os.makedirs(ADAPTER_DIR, exist_ok=True)
    with open(RECIPE_PATH, "w") as f:
        f.write(build_torchtune_config(DATASET_PATH, ADAPTER_DIR))

    run(
        ["tune", "run", "lora_finetune_single_device", "--config", RECIPE_PATH, "resume_from_checkpoint=False"],
        label="torchtune",
    )
    print("[2/5] Fine-tuning complete.")

    # ------------------------------------------------------------------
    # Step 4 — Merge LoRA adapter into full weights (PEFT on CPU)
    # ------------------------------------------------------------------
    print("\n[3/5] Merging LoRA adapter into full model ...")
    os.makedirs(MERGED_DIR, exist_ok=True)

    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_DIR,
        torch_dtype=torch.float16,
        device_map="cpu",        # merge on CPU to keep VRAM free
    )
    tokenizer = AutoTokenizer.from_pretrained(BASE_DIR)

    merged_model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
    merged_model = merged_model.merge_and_unload()
    merged_model.save_pretrained(MERGED_DIR, safe_serialization=True)
    tokenizer.save_pretrained(MERGED_DIR)

    del base_model, merged_model
    torch.cuda.empty_cache()
    print(f"[3/5] Merged model saved to {MERGED_DIR}.")

    # ------------------------------------------------------------------
    # Locate prebuilt llama.cpp binaries
    # ------------------------------------------------------------------
    def find_binary(name: str) -> str:
        candidates = [
            f"/app/{name}",
            f"/app/build/bin/{name}",
            f"/llama.cpp/build/bin/{name}",
            f"/llama.cpp/{name}",
            f"/usr/local/bin/{name}",
            f"/usr/bin/{name}",
        ]
        for p in candidates:
            if Path(p).exists():
                return p
        result = subprocess.run(["which", name], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
        raise FileNotFoundError(f"Could not find binary: {name}. Tried: {candidates}")

    def find_convert_script() -> str:
        candidates = [
            "/app/convert_hf_to_gguf.py",
            "/llama.cpp/convert_hf_to_gguf.py",
            "/llama.cpp/convert-hf-to-gguf.py",
        ]
        for p in candidates:
            if Path(p).exists():
                return p
        raise FileNotFoundError(f"Could not find convert script. Tried: {candidates}")

    quantize_bin  = find_binary("llama-quantize")
    convert_script = find_convert_script()
    print(f"[paths] quantize  : {quantize_bin}")
    print(f"[paths] convert   : {convert_script}")

    # ------------------------------------------------------------------
    # Step 5 — Convert merged model → F16 GGUF
    # ------------------------------------------------------------------
    f16_gguf = "/tmp/model-f16.gguf"
    print("\n[4/5] Converting to F16 GGUF ...")
    run(
        [
            "python3", convert_script,
            MERGED_DIR,
            "--outtype", "f16",
            "--outfile", f16_gguf,
        ],
        label="convert→f16",
    )
    print(f"[4/5] F16 GGUF: {Path(f16_gguf).stat().st_size / 1024 / 1024:.1f} MB")

    # ------------------------------------------------------------------
    # Step 6 — Quantize F16 GGUF → Q4_K_M
    # ------------------------------------------------------------------
    q4_gguf = "/tmp/model-q4_k_m.gguf"
    print("\n[5/5] Quantizing to Q4_K_M ...")
    run(
        [quantize_bin, f16_gguf, q4_gguf, "Q4_K_M"],
        label="quantize→Q4_K_M",
    )
    size_mb = Path(q4_gguf).stat().st_size / 1024 / 1024
    print(f"[5/5] Q4_K_M GGUF: {size_mb:.1f} MB")

    # ------------------------------------------------------------------
    # Persist to Modal Volume
    # ------------------------------------------------------------------
    os.makedirs("/output", exist_ok=True)
    shutil.copy2(q4_gguf, GGUF_VOLUME_PATH)
    vol.commit()

    print(f"\n✅ Done — GGUF saved to volume at {GGUF_VOLUME_PATH}")
    return {
        "gguf_volume_path": GGUF_VOLUME_PATH,
        "gguf_size_mb": round(size_mb, 1),
        "num_records": num_records,
        "download_cmd": f"modal volume get finetune-vol {GGUF_VOLUME_PATH} ./model-q4_k_m.gguf",
    }


# ---------------------------------------------------------------------------
# Web endpoint — POST JSON, get job ID immediately (async)
# ---------------------------------------------------------------------------

@app.function(timeout=10)
@modal.fastapi_endpoint(method="POST", docs=True)
def finetune_endpoint(body: dict | list = Body(...)) -> dict:
    """
    POST your dataset as a JSON array or config dict. Returns immediately with a job ID.
    """
    if not body or not isinstance(body, (list, dict)):
        return {"error": "Body must be a JSON array of {prompt, response} objects, or a dict like {'dataset_name': 'ctf'}"}

    call = finetune_and_quantize.spawn(body)
    return {
        "status": "started",
        "job_id": call.object_id,
        "pipeline": "LoRA fine-tune → merge → Q4_K_M GGUF",
        "output_volume": "finetune-vol",
        "output_path": GGUF_VOLUME_PATH,
        "download_cmd": f"modal volume get finetune-vol {GGUF_VOLUME_PATH} ./model-q4_k_m.gguf",
        "logs_cmd": "modal app logs llama32-gguf-finetune",
    }


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

@app.local_entrypoint()
def main(dataset: str = "dataset.json"):
    """
    Run the full pipeline from the CLI:
        modal run finetune.py --dataset your_data.json
    """
    path = Path(dataset)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    print(f"[local] Loading {path} ...")
    raw = path.read_bytes()
    if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
        text = raw.decode("utf-16")
    elif raw[:3] == b'\xef\xbb\xbf':
        text = raw[3:].decode("utf-8")
    else:
        text = raw.decode("utf-8")
        
    records = json.loads(text)
    
    if isinstance(records, dict) and "dataset_name" in records:
        print(f"[local] Config detected for open-source dataset '{records['dataset_name']}' — submitting to Modal ...")
    else:
        print(f"[local] {len(records)} custom records detected — submitting to Modal ...")

    result = finetune_and_quantize.remote(records)

    print("\n✅ Pipeline complete!")
    print(f"   GGUF on Modal Volume : {result['gguf_volume_path']}")
    print(f"   Size                 : {result['gguf_size_mb']} MB")
    print(f"   Records used         : {result['num_records']}")
    print()
    print("Download your model:")
    print(f"   {result['download_cmd']}")