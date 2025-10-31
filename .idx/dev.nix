# /**
#  * @file .idx/dev.nix
#  * @architectural-role Configuration
#  * @description This file is the single source of truth for defining the declarative, reproducible development environment within IDX. It uses Nix to specify the exact packages, VS Code extensions, and workspace lifecycle hooks required for the project.
#  * @core-principles
#  * 1. IS the canonical definition of the project's development toolchain.
#  * 2. MUST ensure a consistent and reproducible environment for all developers.
#  * 3. OWNS the management of all system-level dependencies (e.g., Node.js, linters, formatters).
#  */

# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    # Add the Node.js 20.x runtime. This is the foundation for our tooling.
    pkgs.nodejs_20
    # Add pnpm as our designated package manager.
    pkgs.pnpm
    # Add ESLint and Prettier, which are available as Node.js packages.
    # This makes the `eslint` and `prettier` commands available in the workspace terminal.
    pkgs.nodePackages.eslint
    pkgs.nodePackages.prettier
  ];

  # Sets environment variables in the workspace
  env = {};
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
      # Add the official ESLint extension to integrate linting into the editor.
      "dbaeumer.vscode-eslint"
      # Add the official Prettier extension to enable format-on-save.
      "esbenp.prettier-vscode"
    ];

    # Enable previews
    previews = {
      enable = true;
      previews = {
        # web = {
        #   # Example: run "npm run dev" with PORT set to IDX's defined port for previews,
        #   # and show it in IDX's web preview panel
        #   command = ["npm" "run" "dev"];
        #   manager = "web";
        #   env = {
        #     # Environment variables to set for your server
        #     PORT = "$PORT";
        #   };
        # };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        # We can now automate the `pnpm install` step.
        # This command will run once when the environment is first built.
        pnpm-install = "pnpm install";
      };
      # Runs when the workspace is (re)started
      onStart = {
        # Example: start a background task to watch and re-build backend code
        # watch-backend = "npm run watch-backend";
      };
    };
  };
}