# POC voxel stack

Sprite stacking no navegador: uma malha 3D (`.glb`) vira uma grade de voxels, e cada camada z é desenhada como uma fatia plana,
girada e empilhada 1 px acima da anterior. Página única, sem build, com o three.js só para ler o `.glb` e posar o esqueleto.

Saiu do projeto DigiLab em 2026-11-22 para um repositório próprio. A documentação completa (a técnica, a conversão da malha, as
texturas do DSTS, as animações, o estúdio e a ficha) está em [`LEIA.md`](LEIA.md).

## Rodar

```bash
python -m http.server 8820 --bind 127.0.0.1
```

Abra uma destas páginas:
- http://localhost:8820/estudio.html: o estúdio, com a interface nova (câmera, animações, luz, modo foto e a ficha do asset);
- http://localhost:8820/agumon.html: a versão de validação do Agumon, com o painel simples;
- http://localhost:8820/index.html: a POC original, com o Mushnub (Quaternius, CC0) e o Nature Kit (Kenney, CC0).

As páginas carregam o three.js pelo jsDelivr: é preciso internet.

## O Agumon não vem no repositório

O `assets/agumon.glb` é o export do `chr050` de Digimon Story Time Stranger (Bandai Namco), feito com o
[dsts-extractor](https://pypi.org/project/dsts-extractor/) a partir de uma cópia própria do jogo. Ele fica fora do git
(`.gitignore`), assim como as capturas e as fichas geradas dele. Para gerar de novo:

```bash
dsts export chr050 --optimized -o <pasta>
```

e copie o `.glb` para `assets/agumon.glb`. Sem ele, as páginas do Agumon mostram o pet procedural de reserva; a `index.html`
funciona com os modelos CC0 que estão aqui.

## A ficha do asset por script

```bash
npm install
npx playwright install chromium
node tools/gerar_ficha.cjs ficha.png 63     # com o servidor rodando; 63 de altura dá 64 camadas
```

## Créditos

- Técnica inspirada no [moon-stack](https://git.patch.gg/rehan/moon-stack). O código daqui foi escrito do zero (a licença do
  Patch não permite tirar código de lá).
- Mushnub: Quaternius, CC0 (`assets/Mushnub_LEIA.txt`). Nature Kit: Kenney, CC0 (`assets/Kenney_License.txt`).
- Nomes dos clipes do DSTS: a tabela `data/animation_names.json` do dsts-viewer (nuffle.me).
