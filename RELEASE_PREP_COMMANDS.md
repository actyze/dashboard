# Repo metadata commands — run after this PR is merged

> Topics drive GitHub search visibility — empty topics = invisible. Run these once after merge to make the repo discoverable.

These commands are **proposals only** and have not been executed. They apply to the live repo immediately and are reversible (you can edit description/homepage/topics again any time via `gh repo edit` or the GitHub UI).

```bash
# Run these after PR is merged. They apply to the live repo immediately and are reversible.
gh repo edit actyze/dashboard --description "Open-source AI-native analytics platform. Natural language to SQL, no-code ML predictions, voice queries, federated multi-DB queries via Trino. AGPL v3, self-hosted."
gh repo edit actyze/dashboard --homepage "https://docs.actyze.io"
gh repo edit actyze/dashboard --add-topic trino --add-topic text-to-sql --add-topic nl2sql --add-topic self-hosted --add-topic ai-analytics --add-topic agpl --add-topic federated-query --add-topic business-intelligence --add-topic data-platform --add-topic llm --add-topic litellm --add-topic open-source-bi
```

## After running

1. Verify on the repo home page that the description, homepage link, and topics show up in the right sidebar.
2. Search GitHub for `topic:trino topic:text-to-sql` and confirm `actyze/dashboard` is indexed (this can take a few minutes).
3. When ready to publish v0.1.0, follow the tagging instructions at the bottom of `RELEASE_NOTES_v0.1.0.md`.
