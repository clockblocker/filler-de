# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `gh issue edit <number> --remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Wayfinding operations

Wayfinder uses one map issue with child issues as decision tickets.

- **Map**: create a single issue labelled `wayfinder:map`. Its body holds Destination, Notes, Decisions so far, Not yet specified, and Out of scope.
- **Child ticket**: create an issue labelled with exactly one ticket type: `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`. Link it to the map as a native GitHub sub-issue using `gh api` on the sub-issues endpoint. If sub-issues are unavailable, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body.
- **Blocking**: use GitHub's native issue dependencies. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric database ID from `gh api repos/<owner>/<repo>/issues/<number> --jq .id`, not its issue number or `node_id`. If dependencies are unavailable, put `Blocked by: #<number>, #<number>` at the top of the child body.
- **Frontier query**: list the map's open children in map order, then exclude tickets with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue named in the fallback `Blocked by` line) and tickets with an assignee. The first remaining ticket is the frontier.
- **Claim**: before doing any work, run `gh issue edit <number> --add-assignee @me`.
- **Resolve**: post the answer as a resolution comment, close the ticket, then append a one-line gist and named link to the map's Decisions so far.

Open, unassigned, unblocked child tickets are the only claimable frontier. Refer to maps and tickets by linked title in human-readable text, never by a bare issue number.
