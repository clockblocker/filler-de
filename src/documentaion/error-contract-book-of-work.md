# Error contract work

Status: One open item.

Use this file only for APIs where callers still infer error meaning from message text.

## Cases

| ID | Boundary | State |
| --- | --- | --- |
| EC-001 | VAM `readContent` | Partial. VAM has typed failures, but one propagation adapter still classifies the nested cause from message text. |

## EC-001 completion

VAM already returns tagged I/O failures. Remove this remaining pattern:

```ts
classifyReadContentError(getErrorMessage(reason.cause))
```

The propagation adapter must classify a missing file from a typed cause. It must keep the race-safe `exists` check for a file that disappears between lookup and read.

Main files:

- `src/packages/independent/vault-action-manager/src/types/read-content-error.ts`
- `src/commanders/textfresser/commands/generate/steps/propagation-ports-adapter.ts`

The item is complete when source code has no message-based read classification and tests assert typed error cases.
