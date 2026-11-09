# Instalador do MeuMMO para Windows.
#
# Como usar: abra o PowerShell e cole esta linha:
#   irm https://raw.githubusercontent.com/bru1dasul-create/meummo/main/instalar-windows.ps1 | iex
#
# O que ele faz:
#   1. instala o Node.js e o Git, se ainda nao tiver (pelo winget);
#   2. baixa o jogo em E:\mmorpg (ou atualiza, se ja estiver la);
#   3. instala as dependencias do jogo;
#   4. cria os atalhos "Jogar MeuMMO" e "Atualizar MeuMMO" na area de trabalho;
#   5. oferece instalar o Tiled (editor de mapas).
# Pode rodar de novo quando quiser. Ele nunca apaga uma pasta que ja tenha outras coisas.
# Para usar outra pasta, rode antes: $env:MEUMMO_PASTA = 'D:\jogos\mmorpg'
#
# Este arquivo nao tem acentos de proposito: assim funciona em qualquer Windows.

function Install-MeuMMO {
    $repo = 'https://github.com/bru1dasul-create/meummo.git'
    $pasta = 'E:\mmorpg'
    if ($env:MEUMMO_PASTA) { $pasta = $env:MEUMMO_PASTA }

    function Passo([string]$texto) {
        Write-Host ''
        Write-Host "==> $texto" -ForegroundColor Cyan
    }
    function Falha([string]$texto) {
        Write-Host ''
        Write-Host "ERRO: $texto" -ForegroundColor Red
    }
    function Recarregar-Path {
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    }
    function Tem([string]$comando) {
        return [bool](Get-Command $comando -ErrorAction SilentlyContinue)
    }
    # Versao do Node como numero: 22.13 vira 2213 (o jogo precisa de 22.13 ou mais novo, por causa do SQLite)
    function Versao-Node {
        if (-not (Tem 'node')) { return 0 }
        $partes = ((& node -v) -replace '^v', '').Split('.')
        return [int]$partes[0] * 100 + [int]$partes[1]
    }
    $nodeMinimo = 2213

    Write-Host ''
    Write-Host '=== Instalador do MeuMMO ===' -ForegroundColor Yellow
    Write-Host "Pasta do jogo: $pasta"

    $disco = Split-Path -Qualifier $pasta
    if (-not (Test-Path "$disco\")) {
        Falha "Nao encontrei o disco $disco. Confira se ele esta conectado."
        return
    }

    # 1. Node.js: roda o servidor e as ferramentas do jogo
    if ((Versao-Node) -lt $nodeMinimo) {
        if (-not (Tem 'winget')) {
            Falha 'Nao consigo instalar o Node.js sozinho (o winget nao esta disponivel). Baixe a versao LTS em https://nodejs.org, instale e rode este instalador de novo.'
            return
        }
        if (Tem 'node') {
            Passo "Atualizando o Node.js $(node -v), que e antigo demais para o jogo (se o Windows pedir permissao, clique em Sim)..."
            winget upgrade -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        } else {
            Passo 'Instalando o Node.js (se o Windows pedir permissao, clique em Sim)...'
            winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        }
        Recarregar-Path
        if ((Versao-Node) -eq 0) {
            Falha 'O Node.js nao ficou disponivel. Feche o PowerShell, abra de novo e cole o comando outra vez.'
            return
        }
        if ((Versao-Node) -lt $nodeMinimo) {
            Falha "O Node.js continua antigo ($(node -v)). Baixe a versao LTS em https://nodejs.org, instale e rode este instalador de novo."
            return
        }
    }
    Write-Host "OK: Node.js $(node -v)" -ForegroundColor Green

    # 2. Git: baixa o jogo e as atualizacoes do GitHub
    if (-not (Tem 'git')) {
        if (-not (Tem 'winget')) {
            Falha 'Nao consigo instalar o Git sozinho (o winget nao esta disponivel). Baixe em https://git-scm.com/download/win, instale e rode este instalador de novo.'
            return
        }
        Passo 'Instalando o Git (se o Windows pedir permissao, clique em Sim)...'
        winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
        Recarregar-Path
        if (-not (Tem 'git')) {
            Falha 'O Git nao ficou disponivel. Feche o PowerShell, abra de novo e cole o comando outra vez.'
            return
        }
    }
    Write-Host "OK: $(git --version)" -ForegroundColor Green

    # 3. Baixa o jogo (ou atualiza, se ja estiver instalado)
    $existe = Test-Path -LiteralPath $pasta
    $vazia = (-not $existe) -or (-not (Get-ChildItem -LiteralPath $pasta -Force | Select-Object -First 1))
    $jaInstalado = $false
    if ($existe -and (Test-Path -LiteralPath (Join-Path $pasta '.git'))) {
        $origem = & git -C $pasta remote get-url origin 2>$null
        $jaInstalado = "$origem" -match 'meummo'
    }

    if ($jaInstalado) {
        Passo 'O jogo ja estava instalado. Baixando a versao mais nova...'
        git -C $pasta pull --ff-only
        if ($LASTEXITCODE -ne 0) {
            Falha 'Nao consegui atualizar o jogo (talvez algum arquivo tenha sido mudado na pasta). Me mostre esta mensagem.'
            return
        }
    } elseif ($vazia) {
        Passo "Baixando o jogo para $pasta..."
        git clone $repo $pasta
        if ($LASTEXITCODE -ne 0) {
            Falha 'Nao consegui baixar o jogo do GitHub. Confira a internet e tente de novo.'
            return
        }
    } else {
        Falha "A pasta $pasta ja existe e tem outros arquivos (talvez de uma tentativa antiga). Para nao apagar nada, parei aqui. Renomeie essa pasta (por exemplo para $($pasta)-antigo) e rode o instalador de novo."
        return
    }

    # 4. Dependencias do jogo
    Passo 'Instalando as dependencias do jogo (na primeira vez demora alguns minutos)...'
    Push-Location -LiteralPath $pasta
    npm.cmd install
    $npmOk = ($LASTEXITCODE -eq 0)
    Pop-Location
    if (-not $npmOk) {
        Falha 'A instalacao das dependencias falhou. Me mostre as mensagens acima.'
        return
    }

    # 5. Atalhos na area de trabalho
    Passo 'Criando os atalhos na area de trabalho...'
    $areaDeTrabalho = [Environment]::GetFolderPath('Desktop')
    $shell = New-Object -ComObject WScript.Shell
    $atalhos = @(
        @{ Nome = 'Jogar MeuMMO'; Arquivo = 'jogar.bat' },
        @{ Nome = 'Atualizar MeuMMO'; Arquivo = 'atualizar.bat' }
    )
    foreach ($item in $atalhos) {
        $atalho = $shell.CreateShortcut((Join-Path $areaDeTrabalho "$($item.Nome).lnk"))
        $atalho.TargetPath = Join-Path $pasta $item.Arquivo
        $atalho.WorkingDirectory = $pasta
        $atalho.Save()
    }

    # 6. Tiled (opcional): o editor de mapas do jogo
    if ((Tem 'winget') -and -not (Test-Path "$env:ProgramFiles\Tiled\tiled.exe")) {
        $querTiled = Read-Host 'Quer instalar tambem o Tiled, o editor de mapas do jogo? (S/N)'
        if ($querTiled -match '^[sS]') {
            Passo 'Instalando o Tiled...'
            winget install -e --id Tiled.Tiled --accept-source-agreements --accept-package-agreements
        }
    }

    Write-Host ''
    Write-Host 'Pronto! O MeuMMO esta instalado.' -ForegroundColor Green
    Write-Host "  Para jogar: atalho 'Jogar MeuMMO' na area de trabalho (ou $pasta\jogar.bat)"
    Write-Host "  Para pegar as novidades: atalho 'Atualizar MeuMMO' (feche o jogo antes)"
    Write-Host ''
    $abrir = Read-Host 'Quer abrir o jogo agora? (S/N)'
    if ($abrir -match '^[sS]') {
        Start-Process -FilePath (Join-Path $pasta 'jogar.bat') -WorkingDirectory $pasta
    }
}

Install-MeuMMO
