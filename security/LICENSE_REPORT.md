# Open Source Licence Report

Answers the question an enterprise reviewer actually asks: *is everything you
ship genuinely open source, and is any of it incompatible with your own
licence?*

Actyze itself is **AGPL-3.0-only**. There is no proprietary component, no
licensed tier, and no paywalled feature.

Generated from CycloneDX/syft SBOMs of the rebuilt images. Regenerate with
`syft <image> -o cyclonedx-json` — CI does this on every push and keeps the
result for 90 days.

---

## Summary

**Yes, with one finding that has been fixed.** Application-level dependencies
are overwhelmingly permissive (MIT, Apache-2.0, BSD). The single genuinely
non-open-source item found has been removed.

| Image | Packages | Python | OS (deb) | Proprietary |
|---|---|---|---|---|
| nexus | 242 | 138 | 97 | 0 |
| prediction-worker-xgboost | 140 | 35 | 98 | 0 |
| prediction-worker-lightgbm | 141 | 36 | 98 | 0 |
| prediction-worker-autogluon | 230 | 122 | 98 | 0 |

Application-level (Python/npm) licence distribution across those images:

| Licence | Packages |
|---|---|
| MIT | 107 |
| Apache-2.0 (incl. variant spellings) | ~85 |
| BSD-2/3-Clause | ~60 |
| PSF-2.0 | 6 |
| MPL-2.0 | 4 |
| LGPL (with exceptions) | 1 |
| Undetermined by the scanner | 9 |

## Finding: NVIDIA CUDA libraries — resolved

The previously published `actyze/dashboard-schema-service` image contained
**15 packages under `LicenseRef-NVIDIA-Proprietary`**:

```
cuda-bindings          nvidia-cufft         nvidia-cusparselt-cu13
nvidia-cublas          nvidia-cufile        nvidia-nccl-cu13
nvidia-cuda-cupti      nvidia-curand        nvidia-nvjitlink
nvidia-cuda-nvrtc      nvidia-cusolver      nvidia-nvshmem-cu13
nvidia-cuda-runtime    nvidia-cusparse      nvidia-cudnn-cu13
```

These are **not open source**. They arrived transitively: `sentence-transformers`
pulls `torch`, and the default PyPI `torch` wheel for Linux bundles the whole
CUDA runtime. The schema service uses `faiss-cpu` and never touches a GPU, so
none of it was reachable code. It also accounted for most of that image's
**9.21 GB**.

Both affected images now install the CPU-only `torch` build from PyTorch's CPU
index before resolving the rest of the requirements, so the CUDA stack is never
pulled in. `security/license-policy.yml` denies these licence identifiers and CI
fails the build if they reappear.

## Copyleft

Only one application-level dependency is copyleft:

- **`psycopg2-binary`** — LGPL-3.0 with an OpenSSL exception. Compatible with
  AGPL-3.0, and used as an unmodified library.

The base images contain the usual Debian and Alpine packages under GPL-2.0,
GPL-3.0 and LGPL (coreutils, glibc, apt and similar). These are **separate
programs aggregated in a filesystem image**, not linked into Actyze code. Under
GPL §2 this is mere aggregation and does not create a combined work. Actyze is
AGPL-3.0 in any case, which is GPL-3.0 compatible.

Their source is obtainable from Debian and Alpine, as required, and neither
distribution's terms are altered by inclusion in an image.

## Nothing found under

Checked for and **absent** from all images: BUSL-1.1, SSPL-1.0, Elastic-2.0,
Commons Clause, non-commercial Creative Commons, and any `LicenseRef-Proprietary`
or `LicenseRef-Commercial` marker. `security/license-policy.yml` denies each of
these and the build fails on a match.

## Undetermined licences

Nine application-level packages report no licence in SBOM metadata. This is a
metadata gap, not evidence of proprietary terms: syft reads the wheel's
`License` field, and some projects declare their licence only in a Trove
classifier or a bundled `LICENSE` file. Debian packages frequently report
nothing for the same reason, and their licences are recorded in
`/usr/share/doc/<pkg>/copyright` inside the image.

The policy currently reports these rather than failing (`fail_on_unknown:
false`). Once the set has been reviewed and confirmed, flip that flag to make
any new undetermined package a build failure.

## Third-party services

Actyze talks to LLM providers through LiteLLM, and to data sources through
Trino. Those are **remote services chosen and configured by the operator**, not
bundled code. Their terms are between the operator and that provider. Nothing
in the images requires a commercial account: LiteLLM (MIT) and Trino
(Apache-2.0) both work against self-hosted backends.
