<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Runtime configuration

- Keep backend configuration integration-managed: use the existing Lovable Vite wrapper and generated clients/auth middleware; diagnose restored-version environment bindings before adding fallbacks, because browser `VITE_*` and server `SUPABASE_*` values must refer to the same project without bundling privileged keys.
