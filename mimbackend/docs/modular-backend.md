# Modüler Backend Kurulumu (Auth & Company)

Bu rehber, backend kod tabanını bağımsız Git modüllerine bölerek katkıda bulunanların yalnızca `auth` paketini, yalnızca geliştirilmekte olan `company` paketini veya her ikisini birden `mimbackend` çatısı altında klonlayabilmesini açıklar.

Yaklaşım, özellik modüllerini Git alt modülü (submodule) olarak içeren *hafif bir orkestratör* deposu (`mimbackend`) kullanır. Her özellik modülü kendi Git geçmişini, Go modül tanımını ve CI hattını korur. Orkestratör deposu ise yerel geliştirme sırasında bu modülleri `go.work` workspace dosyası aracılığıyla birbirine bağlar.

---

## 1. Bağımsız depoları hazırlayın

Organizasyonunuz altında iki yeni Git deposu oluşturun (SSH adresleri örnek olarak verilmiştir):

```bash
# GitHub / GitLab üzerinde yeni depolar
#   git@github.com:hazerfens/mimbackend-auth.git
#   git@github.com:hazerfens/mimbackend-company.git
```

> İpucu: Depo adlarını kullanmayı planladığınız Go modül yolu ile uyumlu tutun (ör. `module github.com/hazerfens/mimbackend-auth`).

---

## 2. Mevcut auth kodunu geçmişi kaybetmeden çıkarın

Mevcut mono-repodan auth ile ilgili klasörleri yeni `mimbackend-auth` deposuna ayırın. `git subtree split` komutu commit geçmişini korur.

```bash
# Mevcut depo kökünden (go-auth)
cd mimbackend

# Yalnızca auth ağacını içeren bir dal oluşturun
SUBTREE_BRANCH=export/auth-module

# Önek (prefix) handlers, services, routes, templates vb. klasörleri kapsar.
# Gerekirse ilave klasörleri de ekleyin.
git subtree split \
  --prefix=internal \
  --rejoin \
  -b "$SUBTREE_BRANCH"

# Yeni auth reposunu klonlayın ve subtree dalını ana dal olarak gönderin
git clone git@github.com:hazerfens/mimbackend-auth.git ../mimbackend-auth
cd ../mimbackend-auth
git pull ../go-auth "$SUBTREE_BRANCH":main
```

> Daha parçalı (granüler) bir çıktı istiyorsanız, birden fazla `git subtree split` komutu çalıştırabilirsiniz (örneğin `internal/handlers/auth` gibi bir önek). Önemli olan, yeni deponun kendi `go.mod` dosyası yerleştirildiğinde bağımsız olarak derlenebilmesidir.

---

## 3. Scaffold the company module repository

```bash
cd ../
git clone git@github.com:hazerfens/mimbackend-company.git
cd mimbackend-company

cat <<'EOF' > go.mod
module github.com/hazerfens/mimbackend-company

go 1.24
EOF

mkdir -p internal/company
cat <<'EOF' > internal/company/model.go
package company

type Company struct {
```
    ---

    ## 3. Company modülü deposunu iskelet olarak oluşturun

    ```bash
    cd ../
    git clone git@github.com:hazerfens/mimbackend-company.git
    cd mimbackend-company

    cat <<'EOF' > go.mod
    module github.com/hazerfens/mimbackend-company


    EOF

    mkdir -p internal/company
    cat <<'EOF' > internal/company/model.go
    package company

## 5. Add submodules for auth and company
      ID   string
      Name string
    }
    EOF
    ```

    Company modülü bağımsız şekilde gelişecektir. Başlangıç dosyalarını commit edin ve gönderin:

    ```bash
    git add go.mod internal/company/model.go
    git commit -m "chore: bootstrap company module"
    git push origin main
    ```

```bash
cd ../go-auth/mimbackend

git submodule add git@github.com:hazerfens/mimbackend-auth.git modules/auth
git submodule add git@github.com:hazerfens/mimbackend-company.git modules/company

git commit -m "chore: add auth and company submodules"
```

This creates a `.gitmodules` file that pins each module to a specific commit. Developers can decide which submodules they want to fetch.

---

## 6. Wire Go workspaces

Create a `go.work` file at the root of `mimbackend` to let Go tooling use both modules locally:

```bash
cd ../go-auth/mimbackend

go work init ./modules/auth ./modules/company
```

Commit the generated `go.work`.

---

## 7. Clone scenarios for contributors

### Clone only the auth module

```bash
git clone git@github.com:hazerfens/mimbackend-auth.git
```

### Clone the orchestrator with auth only

```bash
git clone git@github.com:hazerfens/mimbackend.git
cd mimbackend

git submodule update --init modules/auth
```

### Clone the orchestrator with both auth and company

```bash
git clone --recurse-submodules git@github.com:hazerfens/mimbackend.git
# or
cd mimbackend
git submodule update --init --recursive
```

### Later: pull latest module changes

```bash
# From mimbackend root
git submodule update --remote modules/auth
```

---

## 8. Continuous integration tips

- Keep module-specific CI pipelines inside each submodule repository.
- Add a lightweight orchestrator pipeline that runs `go work sync` and smoke-tests the integration (only when submodules are present).
- Pin submodules to reviewed commits; avoid tracking remote branches directly.

---

## 9. FAQ

**Can I keep working without creating submodules yet?**  Yes. Complete steps 1–5 in a feature branch, review the structure, then merge once the company module is ready.

**What happens if someone does not have the company module cloned?**  Any code that references the company package will fail to build. Document the dependency or guard imports behind build tags.

**Can I use sparse checkout instead?**  Sparse checkout is an alternative if you prefer to keep a single repository. Submodules make ownership and CI boundaries clearer when teams own different modules.

---

With this setup you can iterate on the `auth` or `company` modules independently while still having a single entry point (`mimbackend`) that stitches them together when needed.
