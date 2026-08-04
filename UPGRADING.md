# Upgrading Actyze

**The full upgrade guide lives at
[docs.actyze.io/docs/releases/upgrading](https://docs.actyze.io/docs/releases/upgrading).**

It covers, per release, every breaking change and — importantly — who needs to
act and who does not. Versioning and support policy is at
[docs.actyze.io/docs/releases/versioning](https://docs.actyze.io/docs/releases/versioning).

This file is deliberately a pointer rather than a second copy. Two copies drift,
and a stale upgrade guide is worse than none.

---

## If you are on 0.1.0, upgrade

The `0.1.0` prediction worker images **do not start**. All three
(`prediction-worker-xgboost`, `-lightgbm`, `-autogluon`) fail on import:

```
ImportError: cannot import name 'configure_logging' from 'observability_init'
```

Prediction pipelines are unavailable in that release. The rest of the product is
unaffected. Fixed in `0.1.1`.

## 0.1.1 in one line each

Three changes may need action. Full detail, including exactly who is affected,
is in the [upgrade guide](https://docs.actyze.io/docs/releases/upgrading).

1. **The frontend container listens on 8080, not 80** — it runs unprivileged.
   The Helm chart and published Compose file need no change; hand-written
   manifests targeting container port 80 numerically do. The *Service* port is
   still 80.
2. **`curl` is gone from the Python images** — it existed only to run a
   `HEALTHCHECK` and was itself a CVE source. Default probes already use a
   stdlib call; custom probes shelling out to `curl` need replacing.
3. **Containers run as non-root** (uid 10001, 101 for the frontend, 1000 for
   Trino). Volumes previously written by a root container may need a `chown` or
   an `fsGroup`.

## Related

- [VERSIONING.md](VERSIONING.md) — the versioning and release process, for
  contributors
- [SECURITY.md](SECURITY.md) — security posture and how to report a
  vulnerability
- [GitHub Releases](https://github.com/actyze/dashboard/releases) — full notes
  per release
