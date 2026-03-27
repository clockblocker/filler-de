`independent/` contains workspace packages that do not import any other `@textfresser/*` package.

Rule:
- allowed: npm dependencies, platform APIs, internal files within the same package
- forbidden: imports from sibling workspace packages
