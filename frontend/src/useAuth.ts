import React from "react";

export function useAuth() {
  const [authenticated, setAuthenticated] = React.useState(
    () => !!localStorage.getItem("vitaseed-demo-wallet"),
  );
  const [wallet, setWallet] = React.useState<string>(
    () => localStorage.getItem("vitaseed-demo-wallet") ?? "",
  );
  const [displayName, setDisplayName] = React.useState<string>(
    () => localStorage.getItem("vitaseed-display-name") ?? "",
  );

  function login(name: string) {
    const trimmed = name.trim() || "Anonymous";
    let addr = localStorage.getItem("vitaseed-demo-wallet");
    if (!addr) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      addr =
        "VS" +
        Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
          .slice(0, 16);
      localStorage.setItem("vitaseed-demo-wallet", addr);
    }
    localStorage.setItem("vitaseed-display-name", trimmed);
    setWallet(addr);
    setDisplayName(trimmed);
    setAuthenticated(true);
  }

  function logout() {
    localStorage.removeItem("vitaseed-demo-wallet");
    localStorage.removeItem("vitaseed-display-name");
    setWallet("");
    setDisplayName("");
    setAuthenticated(false);
  }

  return { authenticated, wallet, displayName, login, logout };
}
