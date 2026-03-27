`composed/` contains workspace packages that may depend on `independent/` packages.

Rule:
- allowed: imports from `independent/` workspace packages
- forbidden: being imported by an `independent/` package
