# https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_20
    pkgs.bun

    pkgs.curl
    pkgs.jq
    pkgs.openssl
    pkgs.dnsutils

    pkgs.nmap
    pkgs.nikto
    pkgs.testssl
  ];

  env = {};

  idx = {
    extensions = [];
    previews = { enable = true; previews = {}; };
    workspace = { onCreate = {}; onStart = {}; };
  };
}