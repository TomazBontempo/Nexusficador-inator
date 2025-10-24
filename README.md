# NEXUS Generator Pro

## 🚀 Nova Versão Melhorada

Esta é a versão aprimorada do nexusAutoScript que processa **arquivos FASTA diretamente** e gera arquivos NEXUS com análise automática de haplótipos e distribuição geográfica.

---

## ✨ Novidades

### 1. **Processamento Direto de FASTA**

- ✅ Não precisa mais usar DnaSP para gerar arquivos .hap e .out
- ✅ Arraste o arquivo FASTA e tudo é processado automaticamente
- ✅ Identificação automática de haplótipos únicos

### 2. **Dois Modos de Saída**

#### **Modo Completo**

- Sequências completas (todos os nucleotídeos)
- Ideal para análises filogenéticas robustas
- Software compatível: PAUP, MrBayes, MEGA, RAxML

#### **Modo PopArt** ⭐ NOVO!

- Apenas sites variáveis (SNPs)
- Formato compacto com matchchar (`.`)
- Reduz drasticamente o tamanho do arquivo
- Ideal para redes de haplótipos no PopArt

### 3. **Bloco TRAITS Automático**

- Extrai informação geográfica dos nomes das sequências
- Conta automaticamente amostras por bioma
- Biomas configuráveis via interface
- Formato pronto para PopArt

### 4. **Interface Moderna**

- Design responsivo e intuitivo
- Drag-and-drop para upload
- Preview dos dados antes de gerar
- Estatísticas em tempo real
- Feedback visual completo

---

## 📋 Como Usar

### Passo 1: Preparar o Arquivo FASTA

Seu arquivo deve estar **alinhado** (todas as sequências com o mesmo comprimento):

```fasta
>Aurora-SaoPaulo-MataAtlantica
GGCCTATTCTTAGCCATACACTATACATCAGATACAACCACTGCCTTCTCATCCGTAGCC...

>RK01-MatoGrossoDoSul-Cerrado
GGCCTATTCTTAGCCATACACTATACATCAGATACAACCACTGCCTTCTCATCCGTAGCC...

>Benjamin-MatoGrossoDoSul-Pantanal
GGCCTATTCTTAGCCATACACTATACATCAGATACAACCACTGCCTTCTCATCCGTAGCC...
```

**Formato dos nomes (para detecção automática de biomas):**

- `Nome-Localidade-Bioma`
- O sistema extrai automaticamente a **última parte** após o último hífen (-)
- Exemplo 1: `Aurora-SaoPaulo-MataAtlantica` → Bioma: **MataAtlantica**
- Exemplo 2: `RK11-MatoGrossoDoSul-Cerrado` → Bioma: **Cerrado**
- Exemplo 3: `GQ259914.1-Bolivia(Hte2)-4` → Bioma: **4**

### Passo 2: Carregar o Arquivo

1. Abra `index.html` no navegador
2. Arraste o arquivo FASTA para a área de upload
3. Aguarde o processamento automático

### Passo 3: Configurar Opções

**Escolha o modo de saída:**

- ☑️ **Modo Completo**: Para análises filogenéticas
- ☑️ **Modo PopArt**: Para redes de haplótipos

**Verifique os biomas detectados:**

- Os biomas são extraídos automaticamente da última parte dos nomes (após último hífen)
- Aparecem na seção "Biomas/Localidades Detectadas"
- Se nenhum bioma for detectado, verifique o formato dos nomes das suas sequências

### Passo 4: Gerar NEXUS

1. Revise o preview dos dados
2. Clique em **"Gerar arquivo NEXUS"**
3. O arquivo será baixado automaticamente

---

## 🎯 Formatos de Entrada

### Extensões Aceitas

- `.fas`
- `.fasta`
- `.fa`
- `.txt` (desde que seja FASTA válido)

### Requisitos

- ✅ Sequências alinhadas (mesmo comprimento)
- ✅ Apenas caracteres válidos: `ATCGN-`
- ✅ Formato FASTA padrão (`>Nome` seguido de sequência)
- ✅ Tamanho máximo: 50MB

---

## 📊 Saídas Geradas

### Modo Completo

```nexus
#NEXUS

BEGIN TAXA;
DIMENSIONS NTAX=39;
TAXLABELS
H1 H2 H3 ... H39
;
END;

BEGIN CHARACTERS;
DIMENSIONS NCHAR=931;
FORMAT DATATYPE=DNA  MISSING=? GAP=-;
MATRIX
H1  GGCCTATTCTTAGCCATACACTATACATCA...
H2  GGCCTATTCTTAGCCATACACTATACATCA...
;
END;

BEGIN TRAITS;
Dimensions NTRAITS=5;
TraitLabels MataAtlantica Cerrado Pantanal Amazonia Chaco
Matrix
H1  4,16,12,0,1
H2  1,0,0,0,0
;
END;
```

### Modo PopArt

```nexus
BEGIN CHARACTERS;
DIMENSIONS NCHAR=61;  ← Apenas sites variáveis!
FORMAT DATATYPE=DNA MISSING=? GAP=- MATCHCHAR=.;
MATRIX
H1  TGTTCCGTGGTGGTTACAAGCTTCCTGCCCTTCTTCACTCTGACGTAAACTAGCAGCTTTT
H2  ......................................C......................
H3  C............................................................
;
END;
```

**Vantagens do modo PopArt:**

- Arquivo 90% menor
- Processamento mais rápido no software
- Mesma informação filogenética

---

## 🔍 Funcionalidades Avançadas

### Detecção Automática de Haplótipos

O sistema:

1. Lê todas as sequências do FASTA
2. Compara sequências para identificar duplicatas
3. Agrupa sequências idênticas em haplótipos
4. Numera automaticamente (H1, H2, H3...)
5. Mantém registro de quais amostras pertencem a cada haplótipo

### Extração Geográfica

Para cada sequência:

1. Analisa o nome buscando padrões de bioma
2. Conta quantas amostras por bioma em cada haplótipo
3. Gera o bloco TRAITS formatado
4. Permite configuração personalizada de biomas

### Identificação de Sites Variáveis

No modo PopArt:

1. Compara todas as posições entre haplótipos
2. Identifica apenas posições polimórficas (SNPs)
3. Usa sequência H1 como referência
4. Codifica identidade com `.` (matchchar)

---

## 📖 Exemplos de Uso

### Exemplo 1: Estudo Filogeográfico

```
Input: original.fas (93 sequências, 931 bp)
↓
Output (Modo PopArt):
- 39 haplótipos identificados
- 61 sites variáveis (6.5% do total)
- Distribuição por 5 biomas
- Arquivo: original_PopArt.nex (8 KB vs 120 KB completo)
```

### Exemplo 2: Análise Filogenética

```
Input: dataset.fasta (150 sequências, 1500 bp)
↓
Output (Modo Completo):
- 85 haplótipos únicos
- Sequências completas (1500 bp)
- Pronto para MrBayes/PAUP
- Arquivo: dataset_Complete.nex
```

---

## ⚠️ Troubleshooting

### Erro: "Sequências devem ter o mesmo comprimento"

**Solução:** Alinhe suas sequências antes usando:

- MUSCLE
- MAFFT
- ClustalW
- MEGA (Alignment Explorer)

### Erro: "Caracteres inválidos"

**Solução:** Verifique se há:

- Espaços nas sequências
- Caracteres especiais
- Bases ambíguas (use N para desconhecidas)

### Erro: "Nenhum bioma detectado"

**Solução:**

- O sistema extrai o bioma da **última parte** do nome após o último hífen (-)
- Verifique se seus nomes seguem o padrão: `Nome-Localidade-Bioma`
- Exemplos corretos:
  - `Amostra01-SaoPaulo-MataAtlantica` ✅
  - `RK11-Brasil-Cerrado` ✅
  - `GQ123-Peru-1` ✅
- Se os nomes não seguem esse padrão, renomeie as sequências no arquivo FASTA

### Nenhum haplótipo detectado

**Solução:**

- Todas as sequências são únicas (não há duplicatas)
- Isso é normal em alguns datasets
- Cada sequência = 1 haplótipo

---

## 🔧 Detalhes Técnicos

### Algoritmo de Haplótipos

```javascript
1. Ler FASTA e extrair sequências
2. Criar Map<sequência, haplótipo_id>
3. Para cada sequência:
   - Se sequência já existe no Map: adicionar à lista do haplótipo
   - Se nova: criar novo haplótipo (H_next)
4. Retornar lista de haplótipos com índices e contagens
```

### Identificação de SNPs

```javascript
1. Para cada posição (0 até comprimento):
   - Coletar base de todos os haplótipos
   - Se Set(bases).size > 1: posição é variável
2. Extrair apenas posições variáveis
3. Gerar matriz compacta
```

### Extração Geográfica

```javascript
1. Para cada sequência, extrair última parte do nome (após último hífen)
   - "Aurora-SaoPaulo-MataAtlantica" → "MataAtlantica"
   - "GQ259914.1-Bolivia(Hte2)-4" → "4"
2. Criar lista de biomas únicos detectados (ordenada alfabeticamente)
3. Para cada haplótipo:
   - Contar quantas sequências pertencem a cada bioma
4. Gerar bloco TRAITS com contagens
```

---

## 🆚 Comparação com Versão Anterior

| Recurso                  | Versão Antiga        | Versão Nova     |
| ------------------------ | -------------------- | --------------- |
| **Input**                | .hap + .out (manual) | .fasta (direto) |
| **Haplótipos**           | Manual (DnaSP)       | Automático      |
| **Sites variáveis**      | ❌ Não               | ✅ Sim (PopArt) |
| **Bloco TRAITS**         | ❌ Não               | ✅ Sim          |
| **Biomas configuráveis** | ❌ Não               | ✅ Sim          |
| **Preview**              | ❌ Não               | ✅ Sim          |
| **Validação**            | Básica               | Completa        |
| **Interface**            | Simples              | Moderna         |

---

## 🎓 Workflow Científico

### Antes (manual):

```
Sequências brutas
    ↓ (alinhamento manual)
Sequências alinhadas (.fas)
    ↓ (DnaSP)
.hap + .out
    ↓ (nexusAutoScript antigo)
NEXUS básico
    ↓ (edição manual)
NEXUS com TRAITS
    ↓ (PopArt)
Rede de haplótipos
```

### Agora (automático):

```
Sequências alinhadas (.fas)
    ↓ (NEXUS Generator Pro)
NEXUS com TRAITS (modo PopArt ou Completo)
    ↓ (PopArt / MrBayes / PAUP)
Análise final
```

**Redução:** 5 etapas → 2 etapas ⚡

---

## 📚 Referências

### Software Compatível

**Para Redes de Haplótipos:**

- PopArt: http://popart.otago.ac.nz
- TCS: http://darwin.uvigo.es/software/tcs.html
- Network: https://www.fluxus-engineering.com

**Para Análises Filogenéticas:**

- MrBayes: http://nbisweden.github.io/MrBayes/
- PAUP\*: http://phylosolutions.com/paup-test/
- MEGA: https://www.megasoftware.net
- RAxML: https://cme.h-its.org/exelixis/software.html

---

## 💡 Dicas

### Para Melhor Performance:

1. **Use arquivos alinhados**: Economiza tempo de validação
2. **Nomeie sequências corretamente**: Facilita extração de biomas
3. **Modo PopArt para datasets grandes**: Reduz tamanho drasticamente
4. **Configure biomas antes**: Evita reprocessamento

### Para Melhor Qualidade:

1. **Valide alinhamento**: Use ferramentas especializadas
2. **Remova gaps excessivos**: Melhora análise
3. **Use códigos padronizados**: Para localidades e biomas
4. **Documente metadados**: Mantenha informações claras

---

## 🐛 Report de Bugs

Encontrou um problema? Abra uma issue com:

- Descrição do erro
- Arquivo de exemplo (se possível)
- Navegador e versão
- Mensagem de erro (se houver)

---

## 📜 Licença

Este software é desenvolvido para fins acadêmicos e científicos.

---

## 👨‍💻 Desenvolvimento

**Tecnologias:**

- HTML5 + CSS3 (design moderno)
- JavaScript Vanilla (sem dependências)
- Ionicons (ícones)
- Google Fonts (Inter)

**Compatibilidade:**

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

---

## 🔮 Próximas Funcionalidades

- [ ] Exportação para outros formatos (Phylip, Arlequin)
- [ ] Visualização gráfica de haplótipos
- [ ] Estatísticas de diversidade (Hd, π)
- [ ] Suporte para dados proteicos
- [ ] Modo batch (múltiplos arquivos)

---

**Versão:** 2.0  
**Data:** Outubro 2025  
**Status:** ✅ Produção
