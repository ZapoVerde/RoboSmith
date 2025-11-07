This cheatsheet provides a quick reference for managing your pnpm scripts based on the package.json file you provided.

### Testing

| Command | Description |
|---|---|
| pnpm test | Executes tests using Vitest. This will typically run in watch mode during development. |

### Code Quality

| Command | Description |
|---|---|
| pnpm lint | Lints the project files with the .ts and .tsx extensions using ESLint. |
| pnpm format | Formats all files in the project using Prettier, writing the changes directly to the files. |

### Development

The following scripts are used for the "CONTEXT SLICER" feature of your project. 

| Command | Description |
|---|---|
| pnpm slicer | This is a convenient script that runs both the UI and the watcher for the context slicer in parallel using run-p, which is a part of the npm-run-all package. |
| pnpm dev:slicer:ui | Starts the development server for the context slicer UI. This command changes into the context-slicer directory and runs its dev script. |
| pnpm dev:slicer:watcher | Runs a script to generate a dump file in watch mode. This command changes into the context-slicer directory and executes the generate-dump.ts script using ts-node. The --watch flag ensures that the script automatically reruns when files change. |

**Note on run-p**: The run-p command is a shorthand for npm-run-all --parallel, which executes the subsequent scripts concurrently.