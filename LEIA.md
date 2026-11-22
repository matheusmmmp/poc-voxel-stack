# POC: personagem em voxel por sprite stacking

Uma página só (`index.html`), sem build. Abra com `python -m http.server 8820 --bind 127.0.0.1` na pasta do repositório (no DigiLab, o servidor `poc-voxel` do `.claude/launch.json`), em http://localhost:8820. A página precisa de servidor porque carrega os `.glb` por `fetch`.

A ideia vem do moon-stack (git.patch.gg/rehan/moon-stack). O código foi escrito do zero, porque a licença do Patch não permite tirar o código de lá.

## 1. A técnica

**1. O modelo é uma grade de voxels.** Cada camada z da grade é uma fatia, um desenho plano visto de cima.

**2. Cada fatia é girada e desenhada 1 px acima da anterior.** Um ponto (x, y, z) do mundo cai na tela assim:

```
sx = W/2 + cos(rot)·dx − sin(rot)·dy
sy = H/2 + lift + f·(sin(rot)·dx + cos(rot)·dy) − z
```

- `rot` é o giro da câmera;
- `f` é a inclinação (1 é o empilhamento clássico, visto de cima);
- `z` sobe 1 px por fatia.

A fatia é desenhada ao contrário: para cada pixel da tela dentro da caixa da fatia, a conta volta para a célula da grade. A função é `eachSlice`.

**3. Profundidade = altura.** Ao longo de qualquer pixel da tela, o ponto mais alto é o mais perto de quem olha. Um buffer de profundidade com o z resolve a ordem de tudo, entre modelos e entre fatias, sem ordenar sprites.

**4. Luz por voxel, a cada quadro.**
- Cada voxel guarda uma normal e uma oclusão.
- Quando o modelo gira, o sol é girado para o referencial dele, e o voxel escolhe um nível na rampa de cor do material: `amb + dif·max(N·L, 0)`. A função é `shade`.
- O sol fica parado enquanto o personagem gira.

**5. Passes em 2D sobre o buffer.**
- **Sombra:** cada fatia é projetada no chão ao longo do sol, com deslocamento de `altura · L.xy / L.z`.
- **Contorno:** escurece o pixel que está na frente de algo bem mais longe.
- **Paleta:** cada pixel é um par (material, nível), e uma tabela converte em RGBA.
- O resultado tem cerca de 256 × 192 px e é ampliado com `image-rendering: pixelated`.

**6. Animação.**
- **Personagem:** cada pose é um modelo voxel próprio, e a cena troca o modelo a cada quadro. No andar, o quadro avança pela distância percorrida, para os pés não deslizarem.
- **Empilhar:** cada fatia ganha um deslocamento em z que cai até zero, de baixo para cima. A função é `stackAnim`.

## 2. De malha 3D para voxels (`loadCharacter`)

1. **Carga e pose:** o three.js carrega o `.glb` e aplica o esqueleto na pose pedida, com `AnimationMixer.setTime`.
2. **Rasterização:** os triângulos (`triangles`) são rasterizados numa grade com amostras a cada 0,45 voxel (`voxelizeTris`). Cada voxel recebe a cor do material e a normal do triângulo.
3. **Eixos:** o glTF usa (X, Y para cima, Z para a frente), e aqui vira (x, y para a frente, z para cima).
4. **Preenchimento:** um flood fill a partir da borda marca o que é fora. O resto é interior, e herda a cor e a normal da casca mais próxima. Sem isso, o topo de cada fatia aparece em listras.
5. **Enquadramento:** um só para todos os quadros (`framing`), para o personagem não "pular" de tamanho entre as poses.
6. **Cores:** cada cor sRGB vira uma rampa de 8 níveis (`rampFromRGB`). As sombras puxam para um azul escuro, e as luzes para um branco quente.

## 3. Inserir um personagem (genérico)

**Pela tela:** escolha um `.glb` ou `.gltf` em "Personagem (.glb)", ou arraste o arquivo para a página.
- A conversão roda no navegador. O arquivo não sai da máquina.
- "Altura em voxels" define o tamanho; o pet padrão tem 40.
- O botão "Pet: …" alterna entre o padrão, o pet original e o carregado.

**Pelo código:** troque `PERSONAGEM_PADRAO` (a URL e a altura) no `index.html`.

**Os clipes:**
- Cada estado procura um clipe pelo nome, pelas regras de `CLIPES`:
  - andar: `walk`, `run`;
  - parado: `idle`, `stand`;
  - pulo: `jump`;
  - acenar: `yes`, `wave`, `dance`.
- Para um modelo com outros nomes, basta ajustar as regras.
- Sem animação, a pose parada vale para todos os estados.
- A linha de informação diz quais clipes foram achados.

**Limites:**
- **Formato:** um arquivo só (`.glb`, ou `.gltf` com tudo embutido).
- **Cores:** só a cor do material. Textura e cor por vértice ainda não entram.
- **Escala:** modelos acima de cerca de 80 voxels de altura ficam lentos.

## 4. Arquivos

| arquivo | o quê |
|---|---|
| `index.html` | a POC inteira |
| `index_v1_procedural.html` | a versão 1, com o pet e os objetos montados por formas no código |
| `assets/Mushnub.glb` | o pet padrão, Quaternius, CC0 (`assets/Mushnub_LEIA.txt`) |
| `assets/*.glb` | os objetos da ilha, Kenney Nature Kit, CC0 (`assets/Kenney_License.txt`) |

## 5. O Agumon do DSTS com textura (`agumon.html`, 2026-11-21)

Abra http://localhost:8820/agumon.html. O modelo é `assets/agumon.glb`, o export do dsts-extractor do chr050 (os arquivos de
a pasta chr050 dos dados do jogo; o mesmo export usado no mapa AC do DigiLab). Fica só local: são assets do jogo.

**Por que a versão anterior (o zip) saía sem textura:**
- o export traz a malha `outline` (papel `outline_inflation`): o casco do contorno do jogo, sem textura, que envolve o corpo todo.
  Na grade ele ficava por fora e cobria a textura com uma cor lisa. Agora fica fora da voxelização (o contorno é o passe 2D);
- o rosto usava como cor a folha das pálpebras (b01, UV2), que é quase toda transparente;
- as cores eram quantizadas em 6 níveis por canal (`/51`), o que achatava o laranja do Agumon.

**O que entra agora (`prepararMalhas`, `corNoPonto`, `rasterize`, `buildPalette`, `finishVox`):**
- cada malha vira cor pelo papel do material (`extras.dsts_render.role`): o corpo pelo DiffuseColor (a01); o rosto composto como no
  jogo, pele a01 (UV0) + íris p01 (UV1) + pálpebra b01 (UV2, linha 0 = olho aberto); `outline_inflation` e `eye_shine` ficam fora;
- cada voxel da casca tira a média de todas as amostras de textura que caem nele (amostra a cada 0,5 voxel);
- **normais suaves pelos vértices** (soldados pela posição), interpoladas na amostra. A versão do zip calculava a normal da face
  já nos eixos trocados, o que inverte o sinal: a luz vinha por dentro (média de N·(p − centro) era −4,5; agora +8,6);
- a paleta do personagem sai da pose de referência por corte pela mediana com refino k-means (16 cores: o corpo fica um tom só),
  e cada cor vira uma rampa, como os materiais do moon-stack; a mesma paleta vale para todos os quadros;
- cel em dois tons para os materiais de textura (aceso = a cor da textura, sombra dois degraus abaixo, um fio de brilho), e a
  borda do personagem vira traço escuro no passe de contorno, no lugar da malha `outline` do jogo;
- 84 voxels de altura por padrão (o olho passa a ter pixels); "Altura em voxels" reconverte o Agumon (24–120);
- cada clipe tem a própria grade (`framingClip`): mesma escala, centro e chão da pose parada, mas do tamanho da caixa de todas as
  poses dele, com fatias abaixo do chão (`zoff`). Antes a garra `ba01` saía cortada 28 voxels acima e a queda `bd02` 8 abaixo.

**As animações** (códigos pela tabela `data/animation_names.json` do dsts-viewer):
- parado `bn01`, correr `br01` (o Agumon não tem o andar de campo `fw01`), E = "sim" `fq01`; tocam na velocidade do clipe, e
  o correr avança pela distância andada;
- o seletor "Animação" toca qualquer um dos 33 clipes (uma vez ou repetindo); 1–9 são atalhos: garra, mordida de fogo,
  Pepper Breath 1 e 2, esquiva, dano, vitória, comer, "não";
- 12 quadros voxel por segundo de clipe (de 6 a 30 por clipe), convertidos na primeira vez e guardados;
- o deslocamento no chão (root motion do `J_center`) sai do clipe: quem anda é a cena; fica o sobe-e-desce.

**Limites:** sem piscar (seriam outros quadros com a linha 1 da folha); o brilho do olho é fixo (ver abaixo); o pulo usa a
pose parada (o Agumon não tem clipe de pulo).

**Validação visual contra o print do jogo (2026-11-21, sessão de validação).** Comparado sempre no mesmo enquadramento ("Só o
pet", pixel 4, câmera a −0,3π, `pet.h` = π/2, o parado no quadro 0); capturas em `capturas_validacao/` (`antes.png`,
`depois.png`, `depois_boca_bv01.png` e `lado_a_lado.png`). A cópia de antes é `agumon_antes_validacao.html`. Um ciclo por vez:

1. **Pupila vermelha → preta.** A paleta de 16 cores não tinha preto: a pupila caía no vermelho escuro de dentro da boca.
   Preto e branco entram sempre (`CORES_FIXAS`).
2. **Íris verde.** O verde tem poucos voxels e a mediana gastava as cores em laranjas quase iguais. Agora são 5 cores-base
   (`PALETA_CORES`) mais até 8 cores raras: a amostra mais longe de todas vira cor nova enquanto a distância passar de 6000
   (`CORES_RARAS`). Entram o verde da íris, o rosa da boca, o cinza das garras.
3. **Anel do olho e linhas.** O anel da pálpebra e a linha da boca são finos e sumiam na média das amostras. Um voxel com pelo
   menos 1/3 de amostras escuras e sem cor vira preto (`TINTA`; o verde escuro da íris não conta, por isso o limite de croma).
4. **Brilho do olho.** O do jogo é um matcap (muda com a câmera) e não cabe numa cor por voxel. Virou um disco branco fixo
   na íris aberta, com centro e raio achados pelo alfa do p01 (`brilhosDaIris`, `BRILHO_OLHO`; o −x da folha é o alto do olho
   e o +y o lado do focinho, achados por teste).
5. **Corpo chapado.** Com 5 cores-base o corpo passa de 6 laranjas para 3 (as manchas eram o degradê pintado na textura).
6. **Tom.** O aceso era (213,155,40), mais apagado que o print (~244,172,38). A rampa dos materiais de textura ganha brilho
   ×1,12 e saturação ×1,15 (`TOM_CEL`): aceso (239,164,16). A sombra esquenta em vez de azular (o verde e o azul caem mais
   depressa) e fica um degrau abaixo (nível 4): razão sombra/aceso ~0,88, a mesma medida no print.
7. **Linhas internas.** O contorno interno do personagem risca a partir de um salto de profundidade de 4,5 (os objetos seguem
   com 6; `CONTORNO_INTERNO`). Com 3 virava chuvisco em toda superfície inclinada. O passe de contorno perdeu a closure por
   pixel: ~9,6 ms por quadro na ilha, contra ~9,8 do arquivo de antes, medidos no mesmo painel.

Conferido depois: normais para fora (média de N·(p − centro) = +8,6), nenhuma amostra fora da grade em `ba01`, `bd02` e
`bv01`, parado/correr/"sim" em bn01/br01/fq01.

**O que ainda difere do print e por quê:**
- o olho tem ~7 voxels de largura a 84 de altura: íris, pupila, anel e brilho cabem, mas sem o degradê da íris;
- os dentes da boca aberta têm menos de 1 voxel e quase somem (só a ponta do focinho aparece);
- o contorno tem 1 pixel de arte; o do jogo é mais grosso em volta da cabeça;
- o brilho é fixo, não acompanha a câmera como o matcap;
- a pose do print é de cena; a mais parecida aqui é a vitória (`bv01`), com a boca aberta no meio do clipe.

**Dentes e contorno grosso (2026-11-21).** Mesmo
enquadramento da validação; capturas `capturas_validacao/dentes_antes.png`, `dentes_depois.png`, `dentes_depois_boca_bv01.png`
e `dentes_contorno_lado_a_lado.png` (a boca aberta de antes é a `depois_boca_bv01.png` da validação, mesma pose). Cópia de
antes: `agumon_antes_dentes.html`.

1. **Por que os dentes sumiam.** Não estão na textura do rosto: são 12 cones de geometria na malha do corpo, pintados de um
   cinza claro da a01 (~165,160,145; o toon do jogo acende até o branco). Cada um mede ~0,75 × 2,3 × 1,6 voxel a 84 de altura
   e metade fica dentro do lábio, então a média das amostras de cada voxel puxava para o laranja e a paleta escolhia laranja.
2. **Branco com prioridade.** Como a tinta, um voxel com pelo menos 1/4 de amostras claras e sem cor (`BRANCO`: média > 110,
   croma < 40) vira o branco fixo da paleta. Vale para dentes e garras; as garras passam de cinza para branco, como no print.
3. **Dentes maiores.** As peças brancas da malha são achadas uma vez (`pecasBrancas`: triângulos com texel claro no centro,
   juntados pelos vértices soldados). As pequenas (menores que 4 % da altura da malha: os 12 dentes; as garras medem ~5 voxels)
   crescem ×2 em volta do próprio centro já na pose (`DENTE`), antes das normais: a base entra na gengiva e a ponta sai do lábio.
   Exagero de pixel art, só nos dentes. `__poc.DENTES` conta os voxels com amostra branca e os que viraram branco.
4. **Contorno de 2 px.** O traço do jogo é o casco "outline" inflado para fora. Aqui, o pixel do personagem com textura que
   encosta no chão já virava traço; agora o pixel do chão do outro lado vira traço também (`CONTORNO_FORA`). Fica 2 px na
   silhueta, para fora, sem comer olho, boca ou dentes; as linhas internas seguem com 1 px. Os objetos da ilha não mudam.

Conferido: normais para fora (+8,57 no parado; 8,5–9,4 no 1º quadro dos clipes), `FORA.n` = 0 em `ba01`, `bd02`, `bv01`,
`bn01`, `br01` e `fq01`; atalhos 1, 5 e 9 tocam `ba01`, `bg02` e `fq02`. Ilha com pet e câmera fixos, 10 leituras no mesmo
painel: mediana 10,2 ms por quadro (mín. 9,7) contra 9,9 (mín. 9,7) da cópia de antes. A conversão e o contorno a mais não
pesam além do ruído; o render já estava perto dos 10 ms antes deste passo.

Ainda difere: os dentes são pontas de 1–2 pixels (no jogo são triângulos nítidos); a linha interna segue mais fina que a do
jogo (engrossar ali dobra o chuvisco dos degraus das fatias).

**Brilho do olho pela câmera (2026-11-21).** O disco branco fixo na
textura girava junto com o modelo. No jogo o brilho é o domo `eye_shine` (matcap): fica sempre do mesmo lado do olho para quem
olha. Agora:

1. **Voxels da íris marcados.** `corNoPonto` diz se a amostra caiu na íris aberta (alfa do p01 > 0,5 e pálpebra do b01 < 0,5);
   `rasterize` conta, `finishVox` marca o voxel com metade ou mais das amostras na íris, e `compile` guarda o olho de cada
   célula (`olhoDe`: 1 ou 2 pelo lado do x). O disco fixo na textura saiu (`brilhosDaIris` e `texPos` também).
2. **Brilho em 2D, no referencial da tela.** `drawInst` anota em `F.olh` qual olho cobre cada pixel do pet; depois do contorno,
   `brilhoDosOlhos()` acha o centro e o raio de cada íris vista na tela e pinta de branco um disco deslocado para cima e para a
   esquerda (`BRILHO_OLHO`: dx −0,3, dy −0,32, raio 0,5 da íris), só sobre a íris e fora do traço. Olho com menos de 6 pixels à
   vista (de lado, de costas) fica sem brilho.
3. **Primeira tentativa, descartada:** acender pela normal no referencial da tela (o voxel da íris mais virado para cima e para
   quem olha). O olho daqui é quase plano (normal média (−0,91, 0,40, −0,07), pouca variação): os voxels escolhidos caíam
   espalhados na borda de cima da íris, debaixo do traço e da sobrancelha, e o brilho não aparecia.
4. **Custo:** limpar e varrer `F.olh` só na faixa onde o olho foi desenhado no quadro anterior (`F.olhoP0..P1`); os objetos da
   ilha usam um `hit` sem o teste do olho.

Conferido: girando a câmera de −0,15π a −0,53π em 39 passos, o brilho nunca some (2 a 10 pixels, conforme o ângulo) e fica
sempre em cima à esquerda da íris; capturas em −0,20π, −0,35π e −0,50π, antes e depois, em
`capturas_validacao/brilho_olho_tres_angulos.png` (e `brilho_antes_*.png`, `brilho_depois_*.png`). Normais +8,57 no parado,
`FORA.n` = 0 em `ba01`, `bd02`, `bv01`; parado/correr/"sim" em bn01/br01/fq01; atalhos 1 e 9 tocam `ba01` e `fq02`. Ilha com pet
e câmera fixos: mediana 10,0 ms por quadro, contra 10,25 da cópia de antes (`agumon_antes_brilho.html`), medidos em seguida.
O painel do navegador estava escondido e parava o `requestAnimationFrame`; a medida foi feita em cópias temporárias com o rAF
trocado por um temporizador de 16 ms (o tempo é o do próprio render, dentro do quadro), apagadas depois.

Ainda difere: o brilho tem 2–4 pixels de arte e às vezes sai partido pelo anel da íris (a íris tem ~7 voxels); a variação de
tamanho entre ângulos é o serrilhado da íris na tela, não pisca nem some.

**Brilho do olho maior, na forma do jogo (2026-11-21).** O
reflexo tinha 2–4 pixels e às vezes saía furado. Agora (`brilhoDosOlhos`, `BRILHO_OLHO`):

1. **Duas formas, como no print:** uma mancha elíptica na parte de cima da íris (centro em (−0,10; −0,34) raios, semieixos
   0,78 × 0,52, mínimo 1,2 px) e um ponto pequeno do lado oposto, embaixo à direita (centro em (0,46; 0,44), raio 0,24,
   mínimo 0,5 px; se nenhum centro de pixel cair nele, pinta o pixel do centro).
2. **Proporcional à íris vista:** o raio sai da área de íris na tela a cada quadro (√(pixels/π)), então acompanha zoom, altura
   em voxels e olho de lado. A 84 voxels, com zoom 4 e a íris com ~40 pixels, a mancha tem 13–21 px e o ponto 1–4 px (~1/3
   da íris). `__poc.BRILHO_OLHO.medido` dá, por olho, [pixels de íris, [pintados por forma]].
3. **Sem furos:** a íris vista na tela é salpicada (a pupila às vezes vem de um voxel sem a marca de íris, e o traço interno
   risca o olho por dentro). O brilho cobre os pixels marcados como íris e também os pixels do pet a menos de 0,75 raio do
   centro da íris (`BRILHO_OLHO.dentro`), por cima do traço interno.

Conferido: girando a câmera a volta inteira em 24 passos, o brilho some de costas (−1,00π, −0,92π, 0,83π, 0,92π), aparece
nos dois olhos de frente (−0,08π e 0,00π) e fica com 6 a 24 px no resto; capturas do rosto ×8 em −0,20π, −0,30π e −0,45π,
antes e depois, em `capturas_validacao/brilho_maior_rosto.png`. Normais +8,57 no parado, `FORA.n` = 0 em `ba01`, `bd02`,
`bv01`; parado/correr/"sim" em bn01/br01/fq01; atalhos 1 e 9 tocam `ba01` e `fq02`. Ilha com pet e câmera fixos: mediana
10,05 ms por quadro contra 10,0 da cópia de antes (`agumon_antes_brilho_maior.html`), medidos em seguida (painel escondido:
cópias temporárias com o rAF num temporizador, apagadas depois).

Ainda difere: no jogo o reflexo é um recorte desenhado (matcap do e01h pelo b01m); aqui são duas elipses em pixels de arte. A
íris tem ~7 voxels, então a mancha tem 3–5 px de largura e o centro da íris na tela puxa um pouco para cima, onde a marca de
íris é mais densa.

**Piscar como o jogo (2026-11-21).** Como o `pet3d.ts` do mapa AC: a
folha das pálpebras b01 tem 4 linhas (aberto, fechado, sorriso, bravo) e piscar é ir à linha 1, com a íris deslocada junto
(vec2(0, linha/4) na UV das duas). A linha 1 do p01 é vazia e a do b01 é toda opaca, então o olho fechado é só pálpebra.

1. **Sem converter de novo.** Em `corNoPonto`, nos remendos do rosto (malhas 1 e 2), a amostra também calcula a cor de olho
   fechado quando a pálpebra fechada, a aberta ou a íris tocam. `rasterize` guarda só a diferença (fechado − aberto), num
   mapa esparso por célula, com a diferença de tinta. `finishVox` dá o material de olho fechado às células em que ele difere;
   o interior que copiou a cor dessas células herda a troca (senão a íris aparecia nos degraus das fatias). `compile` guarda
   as listas (`fechadoJ`, `fechadoM`): ~1 300–1 400 células por quadro.
2. **Na piscada**, `shade(M, L, 0, true)` acende essas células com o material de olho fechado (mesmo cel do rosto). Vale para
   o parado, o correr e os clipes tocados, porque está em todo quadro convertido.
3. **Ritmo:** `PISCAR.entre` = [3,1; 4,4; 2,3; 5,2; 1,0; 3,7] s, em ciclo (o 1,0 é a piscada dupla), fechado por
   `PISCAR.fechado` = 0,12 s; ciclo de 20,42 s. `olhoFechado(clock)` decide; `__poc.PISCAR.forcar` = true/false prende o
   olho (capturas), null segue o relógio.
4. **O brilho some** na piscada (no jogo o recorte do b01m na linha fechada é zero): `brilhoDosOlhos` não roda.

Conferido: o olho fechado sai limpo, com a linha curva da pálpebra, em −0,30π e −0,05π (os dois olhos); captura em
`capturas_validacao/piscar_rosto.png` (e `pisca_aberto_*.png`, `pisca_fechado_*.png`). As piscadas caem em 3,10, 7,62,
10,04, 15,36, 16,48 (a dupla), 20,30 s… e duram 0,12 s. Normais +8,57/+8,67/+8,57 (parado/correr/"sim"), `FORA.n` = 0 em
`ba01`, `bd02`, `bv01`; atalhos 1 e 9 tocam `ba01` e `fq02`. Conversão: ba01 2,97 s, bd02 1,63 s, bv01 2,84 s, contra 3,32,
1,80 e 3,05 s da cópia de antes (`agumon_antes_piscar.html`) na mesma rodada. Ilha com pet e câmera fixos: mediana 9,95 ms
por quadro contra 9,9 (painel escondido: cópias temporárias com o rAF num temporizador, apagadas depois).

Ainda difere: a piscada é um corte seco de 0,12 s (como o jogo, que troca a linha sem meio-termo); sorriso e bravo (linhas 2
e 3) não estão ligados a nenhum estado.

**Sem a mancha grande do brilho (2026-11-21).** Saiu a
mancha elíptica do alto da íris; `BRILHO_OLHO.formas` ficou só com o ponto pequeno (centro em (0,46; 0,44) raios, raio 0,24,
mínimo 0,5 px). Ele segue a câmera, some de costas e na piscada, como antes. Sem a mancha o olho não fica sem brilho: o ponto
pinta 1–2 px por olho (medido: 2 px em −0,30π; 2 e 1 px nos dois olhos em −0,05π). Captura do rosto, com e sem a mancha, de
olho aberto: `capturas_validacao/sem_mancha_rosto.png`. Cópia de antes: `agumon_antes_sem_mancha.html`.

**Controle da câmera (2026-11-21).** Antes: arrastar na horizontal girava 0,01 rad/px sem suavizar, a câmera girava sozinha por
padrão (e voltava 4 s depois de andar), sem zoom pela roda, e a inclinação só pelo slider. Agora (`CAM`, `RODA`,
`atualizarCamera`):

| Controle | Faz |
|---|---|
| arrastar na horizontal | gira; 1,5π por largura de tela, suave (a câmera persegue um alvo), com inércia ao soltar em movimento (~1/8 s do movimento, até 6 rad/s; parar antes de soltar não deixa inércia) |
| arrastar na vertical | inclinação (`S.pitch`, na faixa do slider 0,35–1; a altura da tela vale a faixa inteira; para baixo = mais de cima); o slider acompanha |
| roda (e ctrl+roda) | zoom (`S.zoom` inteiro, 2–9), um nível por clique, nunca dois por evento; o touchpad soma até 50 px de delta; o slider acompanha; ctrl+roda não dá zoom na página |
| shift+roda ou roda horizontal | gira 15° a cada 50 px de delta (um clique de mouse ≈ 30°), suave |
| alt+roda | inclinação, 0,04 a cada 50 px de delta |
| pinça de dois dedos | zoom, um nível a cada 25 % de abertura ou fechamento |
| Q / R | gira 45° para um lado e para o outro, a partir do passo de 45° mais perto |
| WASD / setas | andar, relativo à câmera (como antes) |
| "Câmera gira sozinha" | desligado por padrão; ligado, para com qualquer toque/arrasto/roda e só volta 6 s depois (e não gira enquanto o pet é guiado) |

O pet é seguido por `1 − e^(−4·dt)` por quadro (antes um fator fixo de 60 fps). Quem muda `cam.rot` de fora (as capturas)
leva o alvo junto. Sobre o painel a roda rola o painel (menos ctrl+roda). A linha de ajuda do painel lista os controles.

Conferido no navegador (eventos sintéticos, antes do pedido da roda): arrasto de 200 px = 0,736 rad (o esperado para 1280 px);
inclinação e slider acompanham; pinça 2 → 4; Q/R em passos de 45°; giro sozinho parado até 6 s e depois 0,12 rad/s; `cam.rot`
mudado de fora fica. Ilha: 9,8 ms por quadro contra 10,0 da cópia de antes (`agumon_antes_camera.html`). A roda com shift/alt e
o passo de um nível por clique foram escritos depois e só passaram pela checagem de sintaxe: falta testar no navegador.

## 6. O estúdio (`estudio.html`, 2026-11-21)

Abra http://localhost:8820/estudio.html. É o mesmo motor do `agumon.html` (que ficou como estava) com uma interface nova. O desenho e
o porquê estão no vault: `40 Produção e divulgação/POC voxel — análise de UX e estúdio (2026-11-21)`; o plano do vídeo, em
`POC voxel — plano do vídeo de features (2026-11-21)`.

- **Topo à esquerda:** a marca e três pílulas (ms por quadro, voxels por pose, tamanho da arte).
- **Topo à direita:** a cena (Estúdio claro, Noite, Ilha), explodir fatias (X), a gaveta de render e luz, o modo foto (H) e os
  atalhos (?).
- **Trilho à esquerda, câmera:** presets 3/4, Frente, Perfil, Costas, Topo (inclinação 1, o empilhamento clássico) e Herói
  (inclinação 0,4), com transição suave e relativos à frente do pet; C passa para o próximo; "Girar" liga o giro sozinho.
- **Doca embaixo, animações:** abas Estados, Golpes, Defesa, Vida e Cenas; cada chip tem o nome, o código e a tecla (1–9). A linha de
  baixo tem pausar/continuar (P: congela o mundo, a câmera continua), repetir, o progresso do clipe e a velocidade (¼×, ½×, 1×).
- **Gaveta à direita:** o sol (direção e altura, ao vivo), inclinação, pixel, fatias, contorno, giro, altura em voxels, empilhar,
  trocar de pet e carregar outro `.glb`.
- **Carregamento:** um cartão com as etapas (texturas, parado, correr, sim) que sai quando o Agumon fica pronto.
- **Fundos do estúdio:** pixel art no mesmo buffer da cena (`estudioTexel`): degradê radial em níveis, grade de pontos e anel de
  pedestal em volta do pet. No estúdio o pet não passeia sozinho; na ilha passeia como antes.
- **Celular (até 760 px):** a cena e os botões numa fila no topo, os presets numa fila que rola, a doca embaixo e a gaveta como
  folha; pixel 3.
- **Ganchos no motor:** `S.tempo` (o mundo anda em `dt × tempo`, a câmera no tempo real), `S.fundo`, o sol mutável e, em
  `window.__poc`, `tocarClipe`, `ataque`, `pararClipe`, `empilhar`, `mudarZoom`, `mudarInclinacao`. A interface fica em
  `window.__estudio` (tocar, irPreset, mudarCena, explodir, modoFoto, definirTempo), que serve também para gravar o vídeo por script.

## 7. A ficha do asset (botão "Ficha" do estúdio, 2026-11-21)

O botão com a tabela, no topo do `estudio.html`, monta uma ficha 3840×2160 que mostra como o Agumon foi feito: à esquerda, cada
fatia horizontal do modelo voxel vista de cima, numerada de baixo (#01) para cima, com a cor já acesa de cada voxel; à direita, o
stack aberto em isométrico (as fatias a 3,2 px uma da outra, com as placas e as arestas tracejadas) e a pixel art empilhada de 3/4 e
de costas. As vistas são o render do próprio motor (só os pixels do pet, no pixel 1), não um desenho à parte. Para gerar por script:
`window.__estudio.ficha()` devolve o PNG em data URL; `tools/gerar_ficha.cjs` faz isso pelo Playwright. As fichas geradas (`ficha_*.png`) ficam fora do git, porque vêm do modelo do jogo.

## 8. Repositório próprio (2026-11-22)

A POC saiu da pasta do projeto DigiLab para um repositório próprio no GitHub. Ficam
fora do git: o `assets/agumon.glb` (asset do jogo), as capturas da validação, as fichas PNG e as cópias `agumon_antes_*.html`.
