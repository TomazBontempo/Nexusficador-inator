# Guia de Teste - NEXUS Generator Pro

## 🧪 Testando a Nova Versão

### Teste 1: Carregar o arquivo original.fas

1. Abra `index.html` no navegador
2. Arraste o arquivo `original.fas` para a área de upload
3. **Resultado esperado:**
   - ✅ 93 sequências detectadas
   - ✅ 931 bp de comprimento
   - ✅ 39 haplótipos identificados
   - ✅ Preview mostra primeiros haplótipos

### Teste 2: Gerar NEXUS Modo PopArt

1. Selecione **"Modo PopArt"**
2. Mantenha **"Incluir bloco TRAITS"** marcado
3. Clique em **"Gerar arquivo NEXUS"**
4. **Resultado esperado:**
   - ✅ Download de `original_PopArt.nex`
   - ✅ Arquivo contém apenas sites variáveis (~61 posições)
   - ✅ Bloco TRAITS com 5 biomas (default)
   - ✅ Toast de sucesso aparece

### Teste 3: Comparar com PopArt_Script.txt

Abra ambos arquivos e compare:

**original_PopArt.nex (gerado):**

```nexus
BEGIN CHARACTERS;
DIMENSIONS NCHAR=61;  ← Deve ter ~61 sites variáveis
```

**PopArt_Script.txt (referência):**

```nexus
BEGIN CHARACTERS;
DIMENSIONS NCHAR=61;  ← Valor de referência
```

### Teste 4: Configurar Biomas Personalizados

1. Na seção "Configuração de Biomas"
2. Remova "Caatinga" (clique no X)
3. Adicione "MatoGrossodoSul"
4. **Resultado esperado:**
   - ✅ Preview atualiza automaticamente
   - ✅ Bloco TRAITS reflete novos biomas

### Teste 5: Gerar NEXUS Modo Completo

1. Selecione **"Modo Completo"**
2. Desmarque **"Incluir bloco TRAITS"**
3. Clique em **"Gerar arquivo NEXUS"**
4. **Resultado esperado:**
   - ✅ Download de `original_Complete.nex`
   - ✅ Arquivo contém sequências completas (931 bp)
   - ✅ Sem bloco TRAITS

### Teste 6: Validação de Erros

**6.1. Arquivo muito grande**

- Tente carregar arquivo > 50MB
- **Esperado:** Mensagem de erro "Arquivo muito grande"

**6.2. Formato inválido**

- Tente carregar arquivo .txt não-FASTA
- **Esperado:** Erro de formato ou parsing

**6.3. Sequências desalinhadas**

- Crie FASTA com sequências de tamanhos diferentes
- **Esperado:** "As sequências devem ter o mesmo comprimento"

### Teste 7: Reset e Novo Arquivo

1. Clique em **"Novo arquivo"**
2. **Resultado esperado:**
   - ✅ Interface volta ao estado inicial
   - ✅ Área de drop zone visível novamente
   - ✅ Todas as seções ocultas

---

## 📊 Checklist de Funcionalidades

### Interface

- [ ] Drag-and-drop funciona
- [ ] Upload via botão funciona
- [ ] Arquivo é validado corretamente
- [ ] Estatísticas são exibidas (seqs, bp, haps)
- [ ] Botão "Remover arquivo" funciona

### Processamento

- [ ] Parser FASTA funciona corretamente
- [ ] Haplótipos são identificados
- [ ] Sites variáveis são detectados (modo PopArt)
- [ ] Extração geográfica funciona
- [ ] Biomas são contados corretamente

### Opções

- [ ] Radio buttons (Completo/PopArt) funcionam
- [ ] Checkbox TRAITS funciona
- [ ] Adicionar bioma funciona
- [ ] Remover bioma funciona
- [ ] Preview atualiza ao mudar biomas

### Geração

- [ ] Download funciona (modo PopArt)
- [ ] Download funciona (modo Completo)
- [ ] Arquivo tem nome correto
- [ ] Conteúdo NEXUS está formatado
- [ ] Bloco TRAITS está correto
- [ ] Toast de sucesso aparece

### Validação

- [ ] Erro de tamanho funciona
- [ ] Erro de formato funciona
- [ ] Erro de alinhamento funciona
- [ ] Mensagens de erro são claras
- [ ] Erros desaparecem após 5s

### Responsividade

- [ ] Layout funciona em desktop
- [ ] Layout funciona em tablet
- [ ] Layout funciona em mobile
- [ ] Drag-and-drop funciona no mobile
- [ ] Botões são acessíveis no touch

---

## 🔍 Validação de Saída

### Estrutura NEXUS (PopArt)

```nexus
#NEXUS

BEGIN TAXA;
DIMENSIONS NTAX=39;         ← Número de haplótipos
TAXLABELS
H1 H2 H3 ... H39            ← Lista de IDs
;
END;

BEGIN CHARACTERS;
DIMENSIONS NCHAR=61;        ← Sites variáveis (~61)
FORMAT DATATYPE=DNA  MISSING=? GAP=- MATCHCHAR=.;
MATRIX
H1  TGTTCCGTGG...          ← Sequência referência completa
H2  .........C...          ← Matchchar para identidades
;
END;

BEGIN TRAITS;
Dimensions NTRAITS=5;       ← Número de biomas
TraitLabels MataAtlantica Cerrado Pantanal Amazonia Chaco
Matrix
H1  4,16,12,0,1            ← Contagens por bioma
;
END;
```

### Estrutura NEXUS (Completo)

```nexus
#NEXUS

BEGIN TAXA;
DIMENSIONS NTAX=39;
TAXLABELS
H1 H2 ... H39
;
END;

BEGIN CHARACTERS;
DIMENSIONS NCHAR=931;       ← Comprimento completo
FORMAT DATATYPE=DNA  MISSING=? GAP=-;
MATRIX
H1  GGCCTATTCTT...         ← Sequência completa
H2  GGCCTATTCTT...         ← Sequência completa
;
END;
```

---

## 🐛 Bugs Conhecidos

### Nenhum no momento

Se encontrar algum bug, anote:

- Navegador e versão
- Descrição do comportamento
- Passos para reproduzir
- Mensagem de erro (se houver)

---

## ✅ Critérios de Aceitação

Para considerar o teste bem-sucedido:

1. ✅ Todos os arquivos (.html, .css, .js) carregam sem erros
2. ✅ Interface é exibida corretamente
3. ✅ original.fas é processado com sucesso
4. ✅ 39 haplótipos são identificados (mesmo número que DnaSP)
5. ✅ Sites variáveis são ~61 (compatível com PopArt_Script.txt)
6. ✅ Bloco TRAITS é gerado corretamente
7. ✅ Arquivo NEXUS pode ser aberto no PopArt
8. ✅ Nenhum erro no console do navegador

---

## 📝 Log de Testes

### Teste realizado em: **\_**/**\_**/**\_**

| Teste                 | Status | Observações |
| --------------------- | ------ | ----------- |
| Carregar original.fas | ⬜     |             |
| Modo PopArt           | ⬜     |             |
| Modo Completo         | ⬜     |             |
| Biomas personalizados | ⬜     |             |
| Validação de erros    | ⬜     |             |
| Reset/Novo arquivo    | ⬜     |             |
| Responsividade        | ⬜     |             |

**Resultado geral:** ⬜ Aprovado | ⬜ Com ressalvas | ⬜ Reprovado

**Testador:** ******\_\_\_******

**Observações finais:**

---

---

---
