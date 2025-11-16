# 🔬 Melhorias na Haplonet - Aproximação ao PopART

## 📋 Resumo das Mudanças

Este documento descreve as melhorias implementadas no algoritmo Median-Joining Network para aproximar os resultados do PopART e reduzir o número excessivo de linhas e mutações.

---

## ✅ Problemas Identificados e Soluções

### 1. **Tratamento Inconsistente de Gaps e Bases Ambíguas**

**❌ Problema:**

- Na identificação de haplótipos: gaps (`-`) e bases ambíguas (`N`) eram **ignorados**
- No cálculo de distâncias: gaps e `N` eram **contados como mutações**
- Isso causava distâncias infladas e conexões extras desnecessárias

**✅ Solução:**

```javascript
// ANTES: Contava gaps/N como diferenças
function hammingDistance(seq1, seq2) {
  let distance = 0;
  for (let i = 0; i < seq1.length; i++) {
    if (seq1[i] !== seq2[i]) distance++;
  }
  return distance;
}

// DEPOIS: Ignora gaps/N como o PopART
function hammingDistance(seq1, seq2) {
  let distance = 0;
  for (let i = 0; i < seq1.length; i++) {
    const char1 = seq1[i];
    const char2 = seq2[i];

    // Ignore positions with gaps or N in either sequence
    if (char1 === "N" || char1 === "-" || char2 === "N" || char2 === "-") {
      continue;
    }

    if (char1 !== char2) distance++;
  }
  return distance;
}
```

**Impacto:** Reduz significativamente o número de mutações calculadas e simplifica a rede.

---

### 2. **Filtro de Parcimônia Muito Permissivo**

**❌ Problema:**

- O filtro mantinha **todas** as arestas de distância=1 como "reticulations"
- Criava ciclos excessivos e conexões redundantes
- Rede ficava visualmente complexa sem benefício biológico

**✅ Solução:**

```javascript
// ANTES: Aceitava todas arestas de distância=1
const parsimoniousAdditional = additionalEdges.filter((e) => e.distance === 1);

// DEPOIS: Aceita apenas reticulations verdadeiras
const parsimoniousAdditional = [];
for (const edge of additionalEdges) {
  if (edge.distance !== 1) continue;

  // Verifica se o caminho na MST também tem distância 1
  const pathDist = findShortestPath(nodes, mst, edge.source, edge.target);

  // Só mantém se for uma alternativa igualmente parcimoniosa
  if (pathDist === 1) {
    parsimoniousAdditional.push(edge);
  }
}
```

**Impacto:** Remove conexões redundantes, mantendo apenas ciclos biologicamente relevantes.

---

### 3. **Simplificação de Medians Muito Agressiva**

**❌ Problema:**

- O algoritmo removia **todos** os nós medianos de grau 3 conectando haplótipos observados
- Isso simplificava demais a rede, potencialmente perdendo informação biológica
- PopART é mais conservador nessa remoção

**✅ Solução:**
Implementado sistema de **3 níveis de simplificação**:

```javascript
// CONSERVADOR (recomendado - similar ao PopART)
if (algorithmConfig.simplificationLevel === 'conservative') {
  // NÃO comprime nós medianos de grau 3
  // Mantém estrutura mais próxima do PopART
  continue;
}

// MODERADO
if (algorithmConfig.simplificationLevel === 'moderate') {
  // Comprime apenas se:
  // - Todos vizinhos são haplótipos observados (não medianos)
  // - Todas arestas têm distância = 1
}

// AGRESSIVO
if (algorithmConfig.simplificationLevel === 'aggressive') {
  // Comprime liberalmente para simplificar ao máximo
}
```

**Impacto:** Usuário pode escolher o nível de simplificação que melhor se adequa aos seus dados.

---

### 4. **Controle do Epsilon**

**❌ Problema:**

- Epsilon era fixo em 0
- Usuário não podia ajustar a tolerância para aceitar novos medianos

**✅ Solução:**
Adicionado controle deslizante de epsilon (0-3):

```javascript
// Configurável via interface
const epsilon = algorithmConfig.epsilon; // 0, 1, 2 ou 3
```

**Impacto:**

- **Epsilon = 0** (padrão): Rede mais simples, similar ao PopART
- **Epsilon > 0**: Aceita mais medianos, rede mais complexa mas potencialmente mais informativa

---

## 🎛️ Como Usar os Novos Controles

### Interface de Configuração

Na seção **"Configurações do Algoritmo"**, você encontrará:

#### 1. **Epsilon (tolerância para medians)**

- **Valor:** 0 a 3
- **Padrão:** 0 (recomendado)
- **Descrição:** Valor de tolerância para aceitar novos haplótipos medianos
- **Quando aumentar:**
  - Dados com alta diversidade genética
  - Quando suspeitar de haplótipos intermediários não amostrados
- **Quando manter em 0:**
  - Dados bem amostrados
  - Para rede mais limpa e similar ao PopART

#### 2. **Nível de simplificação**

- **Opções:**
  - **Conservador** (recomendado): Mantém mais medianos, similar ao PopART
  - **Moderado**: Remove alguns medianos redundantes
  - **Agressivo**: Simplifica ao máximo

---

## 📊 Comparação: Antes vs Depois

### Antes das Melhorias:

- ❌ Gaps/N contados como mutações
- ❌ Muitas arestas redundantes (todos os pares de distância=1)
- ❌ Remoção agressiva de todos medianos grau-3
- ❌ Epsilon fixo
- **Resultado:** Rede complexa, difícil de interpretar, diferente do PopART

### Depois das Melhorias:

- ✅ Gaps/N ignorados consistentemente
- ✅ Apenas reticulations verdadeiras mantidas
- ✅ Simplificação conservadora por padrão
- ✅ Epsilon configurável
- **Resultado:** Rede mais limpa, similar ao PopART, mais fácil de interpretar

---

## 🔍 Passos para Validação

### Para verificar se sua rede está próxima do PopART:

1. **Conferir distâncias manualmente:**

   - Escolha alguns pares de haplótipos (ex: H1-H2, H3-H5)
   - Conte manualmente as diferenças nas sequências (ignorando gaps/N)
   - Compare com os risquinhos (ticks) na rede
   - ✅ Devem ser iguais

2. **Comparar número de nós medianos:**

   - Conte as bolinhas pretas (median vectors) na sua rede
   - Compare com o PopART
   - ✅ Com "Conservador", deve ser similar

3. **Verificar ciclos (reticulations):**

   - Identifique os ciclos na rede
   - Compare com o PopART
   - ✅ Devem aparecer nos mesmos lugares

4. **Ajustar se necessário:**
   - Se ainda tiver muitos medianos: mude para "Moderado"
   - Se tiver poucos medianos: aumente epsilon para 1
   - Se ciclos diferentes: verifique os dados de entrada

---

## 🎯 Recomendações

### Para aproximar ao máximo do PopART:

1. **Use Epsilon = 0**
2. **Use Simplificação = Conservador**
3. **Verifique que os dados de entrada são idênticos:**
   - Mesmo alinhamento
   - Mesmas sequências
   - Mesmas contagens por haplótipo

### Para explorar alternativas:

1. **Epsilon = 1 ou 2** para dados com alta diversidade
2. **Simplificação = Moderado** se a rede ficar muito poluída
3. **Simplificação = Agressivo** apenas para visualização simplificada

---

## 📝 Notas Técnicas

### Algoritmo Median-Joining

- Implementação baseada em Bandelt, Forster & Röhl (1999)
- Etapas: MSN → Medians → Simplification → Parsimony filter
- As melhorias focam em aproximar a etapa de simplificação ao PopART

### Diferenças Remanescentes

Pequenas diferenças com o PopART podem persistir devido a:

- Ordem de processamento de empates (desempate interno)
- Precisão numérica de ponto flutuante
- Implementação específica do PopART não documentada

### Logs do Console

O algoritmo gera logs detalhados no console do navegador (F12):

- Número de iterações
- Medianos criados/removidos
- Edges antes/depois da simplificação
- Útil para debug e validação

---

## 🐛 Troubleshooting

### "Rede ainda tem muitas linhas"

→ Verifique se epsilon está em 0
→ Use simplificação "Conservador"
→ Confira tratamento de gaps/N nos dados

### "Rede tem menos medianos que PopART"

→ Aumente epsilon para 1
→ Verifique se dados de entrada são idênticos

### "Distâncias diferentes do PopART"

→ Verifique gaps/N no alinhamento
→ Confirme que sítios invariáveis estão sendo tratados igualmente
→ Compare distâncias manualmente

---

## 📚 Referências

- **Bandelt et al. (1999)** - Median-Joining Networks
- **PopART** - http://popart.otago.ac.nz
- **Leigh & Bryant (2015)** - PopART: Population analysis with reticulate trees

---

## ✨ Resultado Esperado

Com as configurações recomendadas (**Epsilon=0, Conservador**), sua rede deve:

- ✅ Ter número similar de medianos ao PopART
- ✅ Mostrar distâncias corretas (ignorando gaps/N)
- ✅ Ter ciclos apenas em locais biologicamente relevantes
- ✅ Ser mais fácil de interpretar e visualizar

**A rede agora deve ficar mais próxima do PopART, facilitando a identificação de grupos de sequências próximas!** 🎉
