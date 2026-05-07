# AGENTS.md

## Cursor Cloud specific instructions

This is a greenfield web project ("homesight") consisting of a single static `index.html` at the repository root. There are currently no package managers, build tools, linters, test frameworks, or backend services.

### Running the application

Serve the project locally with Python's built-in HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in a browser.

### Notes

- No dependencies to install; no `package.json`, `requirements.txt`, or similar manifest exists yet.
- If the project gains a package manager or build tooling in the future, update this file and the VM update script accordingly.
