const categories = [
  { id: "base", label: "基酒" },
  { id: "liqueur", label: "利口酒" },
  { id: "vermouth", label: "味美思/加强酒" },
  { id: "bitters", label: "苦精" },
  { id: "mixer", label: "软饮/调和" },
  { id: "citrus", label: "柑橘/果汁" },
  { id: "syrup", label: "糖浆/甜味" },
  { id: "garnish", label: "装饰/香草" }
];

const flavors = [
  { id: "bright", label: "清爽" },
  { id: "sour", label: "酸" },
  { id: "sweet", label: "甜" },
  { id: "bitter", label: "苦" },
  { id: "herbal", label: "草本" },
  { id: "floral", label: "花香" },
  { id: "smoky", label: "烟熏" },
  { id: "spicy", label: "辛香" },
  { id: "fruity", label: "果味" },
  { id: "creamy", label: "顺滑" },
  { id: "dry", label: "干爽" },
  { id: "strong", label: "烈" }
];

const categoryName = Object.fromEntries(categories.map((category) => [category.id, category.label]));
const flavorName = Object.fromEntries(flavors.map((flavor) => [flavor.id, flavor.label]));
const storageKey = "homebar-pwa-state-v1";
const maxFlavorTags = 3;

const state = loadState();
const selectedFlavors = new Set(["bright"]);
const editingTags = new Set();
let currentRecipe = null;
let deferredInstallPrompt = null;

const elements = {
  views: document.querySelectorAll(".view"),
  navButtons: document.querySelectorAll(".nav-button"),
  flavorTags: document.querySelector("#flavorTags"),
  bottleTags: document.querySelector("#bottleTags"),
  bottleCategory: document.querySelector("#bottleCategory"),
  bottleForm: document.querySelector("#bottleForm"),
  bottleName: document.querySelector("#bottleName"),
  bottleNote: document.querySelector("#bottleNote"),
  editingId: document.querySelector("#editingId"),
  autoTagButton: document.querySelector("#autoTagButton"),
  autoTagStatus: document.querySelector("#autoTagStatus"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  inventoryList: document.querySelector("#inventoryList"),
  savedList: document.querySelector("#savedList"),
  moodInput: document.querySelector("#moodInput"),
  strengthRange: document.querySelector("#strengthRange"),
  strengthLabel: document.querySelector("#strengthLabel"),
  serveMode: document.querySelector("#serveMode"),
  generateButton: document.querySelector("#generateButton"),
  recipePanel: document.querySelector("#recipePanel"),
  installButton: document.querySelector("#installButton")
};

init();

function init() {
  renderCategoryOptions();
  renderFlavorPickers();
  renderInventory();
  renderSaved();
  updateStrengthLabel();
  bindEvents();
  registerServiceWorker();
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  return {
    bottles: [
      bottle("金酒", "base", ["herbal", "dry", "bright"], "适合清爽、草本方向"),
      bottle("白朗姆", "base", ["sweet", "fruity", "bright"], "适合酸甜和热带感"),
      bottle("波本威士忌", "base", ["smoky", "spicy", "strong"], "适合夜晚、厚重、微甜"),
      bottle("金巴利", "liqueur", ["bitter", "herbal", "fruity"], "苦甜红色风味"),
      bottle("干味美思", "vermouth", ["dry", "herbal", "floral"], "可以拉长香气"),
      bottle("柠檬汁", "citrus", ["sour", "bright"], "新鲜更好"),
      bottle("糖浆", "syrup", ["sweet"], "1:1 简单糖浆"),
      bottle("苏打水", "mixer", ["bright", "dry"], "让酒更轻盈")
    ],
    savedRecipes: []
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function bottle(name, category, tags, note = "") {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    tags,
    note,
    favorite: false
  };
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  elements.strengthRange.addEventListener("input", updateStrengthLabel);
  elements.generateButton.addEventListener("click", generateRecipe);
  elements.autoTagButton.addEventListener("click", autoTagBottle);
  elements.bottleForm.addEventListener("submit", saveBottle);
  elements.cancelEditButton.addEventListener("click", resetBottleForm);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  });
}

function switchView(viewId) {
  elements.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  elements.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
}

function renderCategoryOptions() {
  elements.bottleCategory.innerHTML = categories.map((category) => (
    `<option value="${category.id}">${category.label}</option>`
  )).join("");
}

function renderFlavorPickers() {
  renderTagButtons(elements.flavorTags, selectedFlavors, "inspire");
  renderTagButtons(elements.bottleTags, editingTags, "bottle");
}

function renderTagButtons(container, selectedSet, scope) {
  container.innerHTML = flavors.map((flavor) => {
    const active = selectedSet.has(flavor.id) ? " active" : "";
    const locked = !active && selectedSet.size >= maxFlavorTags;
    return `<button class="tag-chip${active}${locked ? " locked" : ""}" data-scope="${scope}" data-flavor="${flavor.id}" type="button" ${locked ? `title="最多选择 ${maxFlavorTags} 种味道"` : ""}>${flavor.label}</button>`;
  }).join("");

  container.querySelectorAll(".tag-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const flavor = button.dataset.flavor;
      if (selectedSet.has(flavor)) {
        selectedSet.delete(flavor);
      } else {
        if (selectedSet.size >= maxFlavorTags) {
          setFlavorLimitHint(scope);
          return;
        }
        selectedSet.add(flavor);
      }
      renderTagButtons(container, selectedSet, scope);
    });
  });
}

function setFlavorLimitHint(scope) {
  if (scope === "bottle") {
    setAutoTagStatus(`最多选择 ${maxFlavorTags} 种味道`, "warn");
    return;
  }
  const label = document.querySelector("#strengthLabel");
  if (!label) return;
  label.textContent = `最多 ${maxFlavorTags} 种味道`;
  window.setTimeout(updateStrengthLabel, 1100);
}

function updateStrengthLabel() {
  const labels = {
    1: "很轻",
    2: "偏轻",
    3: "适中",
    4: "偏烈",
    5: "很烈"
  };
  elements.strengthLabel.textContent = labels[elements.strengthRange.value];
}

function saveBottle(event) {
  event.preventDefault();
  const name = elements.bottleName.value.trim();
  if (!name) return;

  const nextBottle = {
    id: elements.editingId.value || crypto.randomUUID(),
    name,
    category: elements.bottleCategory.value,
    tags: Array.from(editingTags),
    note: elements.bottleNote.value.trim(),
    favorite: false
  };

  const index = state.bottles.findIndex((item) => item.id === nextBottle.id);
  if (index >= 0) {
    nextBottle.favorite = state.bottles[index].favorite;
    state.bottles[index] = nextBottle;
  } else {
    state.bottles.push(nextBottle);
  }

  saveState();
  resetBottleForm();
  renderInventory();
}

function resetBottleForm() {
  elements.bottleForm.reset();
  elements.editingId.value = "";
  setAutoTagStatus("输入名称后可自动推荐标签");
  elements.cancelEditButton.hidden = true;
  editingTags.clear();
  renderTagButtons(elements.bottleTags, editingTags, "bottle");
}

function editBottle(id) {
  const item = state.bottles.find((bottleItem) => bottleItem.id === id);
  if (!item) return;
  elements.editingId.value = item.id;
  elements.bottleName.value = item.name;
  elements.bottleCategory.value = item.category;
  elements.bottleNote.value = item.note || "";
  setAutoTagStatus("可重新联网识别并覆盖标签");
  editingTags.clear();
  item.tags.forEach((tag) => editingTags.add(tag));
  elements.cancelEditButton.hidden = false;
  renderTagButtons(elements.bottleTags, editingTags, "bottle");
  switchView("barView");
}

function deleteBottle(id) {
  state.bottles = state.bottles.filter((item) => item.id !== id);
  saveState();
  renderInventory();
}

function toggleFavorite(id) {
  const item = state.bottles.find((bottleItem) => bottleItem.id === id);
  if (!item) return;
  item.favorite = !item.favorite;
  saveState();
  renderInventory();
}

async function autoTagBottle() {
  const name = elements.bottleName.value.trim();
  if (!name) {
    setAutoTagStatus("先输入一个酒或材料名称", "warn");
    elements.bottleName.focus();
    return;
  }

  elements.autoTagButton.disabled = true;
  setAutoTagStatus("正在搜索公开百科资料...");

  try {
    const result = await lookupBottleProfile(name);
    const inferred = inferBottleProfile(name, result.text);
    if (inferred.category) {
      elements.bottleCategory.value = inferred.category;
    }

    const recommendedTags = inferred.tags.slice(0, maxFlavorTags);
    editingTags.clear();
    recommendedTags.forEach((tag) => editingTags.add(tag));
    renderTagButtons(elements.bottleTags, editingTags, "bottle");

    if (!elements.bottleNote.value.trim() && result.sourceTitle) {
      elements.bottleNote.value = `根据 ${result.sourceTitle} 摘要推荐`;
    }

    const source = result.sourceTitle ? `参考：${result.sourceTitle}` : "未找到百科结果，已用本地规则";
    setAutoTagStatus(`${source}；推荐 ${recommendedTags.map((tag) => flavorName[tag]).join("、") || "清爽"}`, "good");
  } catch {
    const inferred = inferBottleProfile(name, "");
    const recommendedTags = inferred.tags.slice(0, maxFlavorTags);
    editingTags.clear();
    recommendedTags.forEach((tag) => editingTags.add(tag));
    renderTagButtons(elements.bottleTags, editingTags, "bottle");
    if (inferred.category) elements.bottleCategory.value = inferred.category;
    setAutoTagStatus("联网失败，已用本地规则推荐", "warn");
  } finally {
    elements.autoTagButton.disabled = false;
  }
}

function setAutoTagStatus(message, tone = "") {
  elements.autoTagStatus.textContent = message;
  elements.autoTagStatus.classList.toggle("good", tone === "good");
  elements.autoTagStatus.classList.toggle("warn", tone === "warn");
}

async function lookupBottleProfile(name) {
  const searchUrl = new URL("https://zh.wikipedia.org/w/api.php");
  searchUrl.search = new URLSearchParams({
    action: "opensearch",
    search: name,
    limit: "3",
    namespace: "0",
    format: "json",
    origin: "*"
  }).toString();

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) throw new Error("search failed");
  const searchData = await searchResponse.json();
  const titles = searchData[1] || [];
  const descriptions = searchData[2] || [];
  const title = titles[0] || "";
  const description = descriptions[0] || "";

  if (!title) {
    return { sourceTitle: "", text: "" };
  }

  const extractUrl = new URL("https://zh.wikipedia.org/w/api.php");
  extractUrl.search = new URLSearchParams({
    action: "query",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    titles: title,
    format: "json",
    origin: "*"
  }).toString();

  const extractResponse = await fetch(extractUrl);
  if (!extractResponse.ok) {
    return { sourceTitle: title, text: `${title} ${description}` };
  }

  const extractData = await extractResponse.json();
  const pages = Object.values(extractData.query?.pages || {});
  const extract = pages[0]?.extract || "";
  return { sourceTitle: title, text: `${title} ${description} ${extract}` };
}

function inferBottleProfile(name, remoteText) {
  const text = `${name} ${remoteText}`.toLowerCase();
  const tags = new Set();
  const category = inferBottleCategory(name, remoteText);

  const tagRules = [
    ["bright", ["清爽", "爽脆", "柑橘", "柠檬", "青柠", "苹果", "梨", "气泡", "苏打", "tonic", "citrus", "lemon", "lime", "fresh"]],
    ["sour", ["酸", "柠檬", "青柠", "醋", "酸橙", "lemon", "lime", "酸味"]],
    ["sweet", ["甜", "糖", "蜂蜜", "糖浆", "甘甜", "香草", "焦糖", "liqueur", "sweet"]],
    ["bitter", ["苦", "金巴利", "苦艾", "苦精", "奎宁", "campari", "bitters", "bitter"]],
    ["herbal", ["草本", "药草", "杜松子", "薄荷", "迷迭香", "百里香", "植物", "gin", "herbal", "botanical"]],
    ["floral", ["花", "玫瑰", "接骨木", "紫罗兰", "茉莉", "floral", "elderflower"]],
    ["smoky", ["烟熏", "泥煤", "橡木", "木桶", "烘烤", "peated", "smoky", "oak"]],
    ["spicy", ["辛香", "辛辣", "辣", "肉桂", "丁香", "胡椒", "姜", "spicy", "pepper"]],
    ["fruity", ["果", "葡萄", "莓", "桃", "杏", "菠萝", "椰子", "橙", "fruit", "berry", "grape"]],
    ["creamy", ["奶", "奶油", "椰奶", "可可", "巧克力", "cream", "creamy", "chocolate"]],
    ["dry", ["干", "干型", "不甜", "dry", "brut"]],
    ["strong", ["烈酒", "蒸馏", "威士忌", "伏特加", "朗姆", "龙舌兰", "白兰地", "whisky", "whiskey", "vodka", "rum", "tequila", "brandy"]]
  ];

  tagRules.forEach(([tag, keywords]) => {
    if (keywords.some((keyword) => text.includes(keyword))) {
      tags.add(tag);
    }
  });

  if (!tags.size) {
    tags.add(category === "base" ? "strong" : "bright");
  }

  return { category, tags: Array.from(tags).slice(0, 5) };
}

function inferBottleCategory(name, remoteText) {
  const nameText = name.toLowerCase();
  const allText = `${name} ${remoteText}`.toLowerCase();

  const strongNameRules = [
    ["mixer", ["牛奶", "奶", "鲜奶", "椰奶", "椰乳", "椰浆", "椰汁", "椰子水", "酸奶", "乳酸菌", "养乐多", "milk", "cream", "coconut milk", "coconut cream", "coconut water", "yogurt", "yakult"]],
    ["base", ["金酒", "琴酒", "威士忌", "伏特加", "朗姆", "龙舌兰", "特基拉", "白兰地", "干邑", "烧酒", "白酒", "gin", "whisky", "whiskey", "vodka", "rum", "tequila", "brandy", "cognac"]],
    ["bitters", ["苦精", "bitters"]],
    ["syrup", ["糖浆", "蜂蜜", "糖水", "syrup"]],
    ["citrus", ["柠檬汁", "青柠汁", "橙汁", "西柚汁", "果汁", "juice"]],
    ["mixer", ["苏打", "汤力", "可乐", "姜汁汽水", "气泡水", "tonic", "soda", "cola"]],
    ["vermouth", ["味美思", "vermouth"]],
    ["liqueur", ["利口酒", "力娇酒", "金巴利", "君度", "咖啡利口", "liqueur", "campari", "cointreau"]],
    ["garnish", ["薄荷", "迷迭香", "橙皮", "柠檬皮", "装饰"]]
  ];

  const strongMatch = strongNameRules.find(([, keywords]) => keywords.some((keyword) => nameText.includes(keyword)));
  if (strongMatch) return strongMatch[0];

  const contextRules = [
    ["mixer", ["牛奶", "鲜奶", "椰奶", "椰乳", "椰浆", "椰汁", "椰子水", "酸奶", "乳酸菌", "养乐多", "milk", "cream", "coconut milk", "coconut cream", "coconut water", "yogurt", "yakult"]],
    ["bitters", ["苦精", "bitters"]],
    ["citrus", ["柠檬汁", "青柠汁", "果汁", "juice"]],
    ["mixer", ["苏打", "汤力", "可乐", "姜汁汽水", "气泡水", "tonic", "soda", "cola"]],
    ["vermouth", ["味美思", "加强葡萄酒", "vermouth"]],
    ["liqueur", ["利口酒", "力娇酒", "liqueur", "campari", "金巴利", "君度", "cointreau"]],
    ["base", ["烈酒", "蒸馏酒", "金酒", "威士忌", "伏特加", "朗姆", "龙舌兰酒", "白兰地", "gin", "whisky", "whiskey", "vodka", "rum", "tequila", "brandy"]],
    ["syrup", ["糖浆", "蜂蜜", "糖水", "syrup"]],
    ["garnish", ["薄荷", "迷迭香", "橙皮", "柠檬皮", "装饰"]]
  ];

  return contextRules.find(([, keywords]) => keywords.some((keyword) => allText.includes(keyword)))?.[0] || "base";
}

function renderInventory() {
  if (!state.bottles.length) {
    elements.inventoryList.innerHTML = emptyList("还没有材料", "先添加家里的酒、果汁、糖浆和气泡水。");
    return;
  }

  elements.inventoryList.innerHTML = categories.map((category) => {
    const items = state.bottles.filter((item) => item.category === category.id);
    if (!items.length) return "";

    const rows = items.map((item) => `
      <div class="bottle-row">
        <div>
          <h3>${escapeHtml(item.name)} ${item.favorite ? "★" : ""}</h3>
          ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
          <div class="mini-tags">${item.tags.map((tag) => `<span>${flavorName[tag]}</span>`).join("")}</div>
        </div>
        <div class="bottle-actions">
          <button class="ghost-button" data-action="favorite" data-id="${item.id}" type="button">${item.favorite ? "取消常用" : "常用"}</button>
          <button class="ghost-button" data-action="edit" data-id="${item.id}" type="button">编辑</button>
          <button class="danger-button" data-action="delete" data-id="${item.id}" type="button">删除</button>
        </div>
      </div>
    `).join("");

    return `
      <section class="inventory-group">
        <div class="group-header">
          <span>${category.label}</span>
          <span>${items.length}</span>
        </div>
        ${rows}
      </section>
    `;
  }).join("");

  elements.inventoryList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const { action, id } = button.dataset;
      if (action === "edit") editBottle(id);
      if (action === "delete") deleteBottle(id);
      if (action === "favorite") toggleFavorite(id);
    });
  });
}

function generateRecipe() {
  const prompt = elements.moodInput.value.trim();
  const tags = inferTags(prompt, selectedFlavors);
  const strength = Number(elements.strengthRange.value);
  if (strength >= 4) addLimitedTag(tags, "strong", { prefer: true });
  if (strength <= 2) {
    tags.delete("strong");
    if (!tags.size) tags.add("bright");
  }

  const base = pickBottle(["base"], tags);
  const modifier = pickBottle(["liqueur", "vermouth", "bitters"], tags, base?.id);
  const citrus = pickBottle(["citrus"], tags);
  const syrup = pickBottle(["syrup"], tags);
  const mixer = pickBottle(["mixer"], tags);
  const garnish = pickBottle(["garnish"], tags);
  const template = chooseClassicTemplate({ base, tags, selectedMode: elements.serveMode.value, strength });
  const serve = randomizeServe({
    id: template.serve,
    label: template.name,
    glass: template.glass,
    long: template.method === "build",
    shaken: template.method === "shake",
    stirred: template.method === "stir"
  });
  const ingredients = buildIngredientsFromTemplate({ template, base, modifier, citrus, syrup, mixer, tags, strength });
  const profile = buildProfile({ prompt, tags, ingredients, template, strength });
  const recipeName = buildRecipeName({ prompt, profile, ingredients, serve, tags, template });
  const abstractName = buildAbstractRecipeName({ prompt, ingredients, serve, tags });

  currentRecipe = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: recipeName,
    classicName: recipeName,
    abstractName,
    customName: "",
    nameMode: "classic",
    art: buildRecipeArt(recipeName, tags, serve),
    moodLine: profile.line,
    templateName: template.name,
    tags: Array.from(tags),
    glass: serve.glass,
    garnish: chooseRecipeGarnish({ garnish, tags, ingredients, template, serve }),
    ingredients,
    steps: buildSteps(serve, profile)
  };

  renderRecipe(currentRecipe);
}

function inferTags(prompt, selected) {
  const tags = new Set(Array.from(selected).slice(0, maxFlavorTags));
  const text = prompt.toLowerCase();
  const map = [
    ["清爽", "bright"], ["夏", "bright"], ["轻", "bright"], ["酸", "sour"],
    ["甜", "sweet"], ["苦", "bitter"], ["草", "herbal"], ["花", "floral"],
    ["烟", "smoky"], ["木", "smoky"], ["辣", "spicy"], ["辛", "spicy"],
    ["果", "fruity"], ["莓", "fruity"], ["顺", "creamy"], ["奶", "creamy"],
    ["干", "dry"], ["烈", "strong"], ["夜", "strong"], ["雨", "herbal"],
    ["海", "bright"], ["咖啡", "bitter"]
  ];

  map.forEach(([keyword, tag]) => {
    if (text.includes(keyword)) addLimitedTag(tags, tag);
  });

  if (!tags.size) tags.add("bright");
  return tags;
}

function addLimitedTag(tags, tag, { prefer = false } = {}) {
  if (tags.has(tag)) return;
  if (tags.size < maxFlavorTags) {
    tags.add(tag);
    return;
  }
  if (!prefer) return;
  const removable = Array.from(tags).find((item) => item !== "strong");
  if (!removable) return;
  tags.delete(removable);
  tags.add(tag);
}

function pickBottle(categoryIds, tags, excludedId) {
  const candidates = state.bottles.filter((item) => categoryIds.includes(item.category) && item.id !== excludedId);
  if (!candidates.length) return null;
  return weightedPick(candidates.map((item) => ({
    item,
    weight: Math.max(1, scoreBottle(item, tags)) + Math.random() * 3
  })));
}

function scoreBottle(item, tags) {
  const overlap = item.tags.filter((tag) => tags.has(tag)).length * 3;
  return overlap + (item.favorite ? 2 : 0);
}

function chooseClassicTemplate({ base, tags, selectedMode, strength }) {
  const templates = classicTemplates();
  const family = baseFamily(base?.name || "");
  const candidates = templates.map((template) => {
    let weight = 1;
    if (template.families.includes(family)) weight += 7;
    if (template.families.includes("any")) weight += 1.5;
    template.tags.forEach((tag) => {
      if (tags.has(tag)) weight += 4;
    });
    weight = applyFlavorTemplateBias(weight, template, tags);
    if (selectedMode === "long" && template.method === "build") weight += 5;
    if (selectedMode === "shaken" && template.method === "shake") weight += 5;
    if (selectedMode === "stirred" && template.method === "stir") weight += 5;
    if (selectedMode === "short" && template.method !== "build") weight += 4;
    if (strength >= 4 && template.strong) weight += 2;
    weight = applyStrengthTemplateBias(weight, template, strength, selectedMode);
    if (template.roles.length >= 4) weight += 2.2;
    if (template.roles.length >= 5) weight += 1.6;
    weight = applyFlavorFocusBias(weight, template, tags);
    if (template.social && Math.random() > 0.35) weight += 2.5;
    return { item: template, weight };
  });

  return weightedPick(candidates);
}

function applyFlavorFocusBias(weight, template, tags) {
  let nextWeight = weight;
  const selected = Array.from(tags).filter((tag) => tag !== "strong");
  if (!selected.length) return nextWeight;
  const matches = selected.filter((tag) => template.tags.includes(tag)).length;
  const missing = selected.length - matches;
  nextWeight += matches * 5;
  if (missing) nextWeight *= Math.max(0.38, 1 - missing * 0.22);
  if (selected.length >= 2 && matches >= selected.length - 1 && template.roles.length >= 4) nextWeight += 6;
  if (selected.length === 3 && matches === 3) nextWeight += 10;
  return Math.max(nextWeight, 0.05);
}

function applyStrengthTemplateBias(weight, template, strength, selectedMode) {
  let nextWeight = weight;
  const userAskedShort = selectedMode === "short" || selectedMode === "shaken" || selectedMode === "stirred";

  if (strength <= 1) {
    if (template.method === "build" || template.serve === "highball" || template.serve === "spritz") nextWeight += 16;
    if (template.serve === "sour" && template.social) nextWeight += 4;
    if (template.strong || template.serve === "stirred" || template.serve === "nightcap") nextWeight *= 0.08;
    if (template.serve === "sour" && !userAskedShort) nextWeight *= 0.28;
  } else if (strength === 2) {
    if (template.method === "build" || template.serve === "highball" || template.serve === "spritz") nextWeight += 10;
    if (template.serve === "sour" && template.social) nextWeight += 6;
    if (template.strong || template.serve === "stirred" || template.serve === "nightcap") nextWeight *= 0.2;
    if (template.serve === "sour" && !template.social && !userAskedShort) nextWeight *= 0.55;
  } else if (strength >= 4) {
    if (template.strong || template.serve === "sour" || template.serve === "stirred" || template.serve === "nightcap") nextWeight += 6;
    if (template.method === "build" && strength >= 5) nextWeight *= 0.75;
  }

  return Math.max(nextWeight, 0.05);
}

function applyFlavorTemplateBias(weight, template, tags) {
  const hasTag = (tag) => template.tags.includes(tag);
  const hasRole = (role) => template.roles.some((part) => part.role === role);
  let nextWeight = weight;

  if (tags.has("sour")) {
    if (hasTag("sour") || template.serve === "sour") {
      nextWeight += 14;
    } else if (hasRole("lime") || hasRole("lemon")) {
      nextWeight += 5;
    } else {
      nextWeight *= 0.18;
    }
  }
  if (tags.has("bitter")) {
    if (hasTag("bitter") || hasRole("bitterLiqueur") || hasRole("bitters")) {
      nextWeight += 10;
    } else {
      nextWeight *= 0.45;
    }
  }
  if (tags.has("sweet")) {
    if (hasTag("sweet") || hasRole("syrup") || hasRole("jamOrSyrup") || hasRole("yogurtMixer")) {
      nextWeight += 6;
    }
  }
  if (tags.has("fruity")) {
    if (hasTag("fruity") || hasRole("jamOrSyrup") || hasRole("orangeLiqueur") || hasRole("pineappleJuice")) {
      nextWeight += 6;
    }
  }
  if (tags.has("creamy")) {
    if (hasTag("creamy") || hasRole("coconutMilk") || hasRole("milkCream") || hasRole("yogurtMixer")) {
      nextWeight += 10;
    } else {
      nextWeight *= 0.55;
    }
  }
  if (tags.has("spicy")) {
    if (hasTag("spicy") || hasRole("gingerMixer") || hasRole("spiceSyrup")) {
      nextWeight += 9;
    }
  }
  if (tags.has("bright")) {
    if (hasTag("bright") || hasRole("lime") || hasRole("lemon") || template.method === "build") {
      nextWeight += 5;
    }
  }
  if (tags.has("floral") || tags.has("herbal")) {
    if (hasTag("floral") || hasTag("herbal") || hasRole("teaOrMixer") || hasRole("vermouth")) {
      nextWeight += 6;
    }
  }
  if (tags.has("smoky")) {
    if (hasTag("smoky") || hasTag("strong") || template.serve === "nightcap") {
      nextWeight += 5;
    } else {
      nextWeight *= 0.65;
    }
  }

  return Math.max(nextWeight, 0.1);
}

function classicTemplates() {
  return [
    {
      name: "Margarita",
      families: ["tequila"],
      tags: ["sour", "bright", "fruity"],
      method: "shake",
      serve: "sour",
      glass: "鸡尾酒杯或古典杯",
      roles: [
        { role: "base", amount: ["45 ml", "50 ml", "60 ml"] },
        { role: "orangeLiqueur", amount: ["15 ml", "20 ml", "22.5 ml"] },
        { role: "lime", amount: ["15 ml", "20 ml", "22.5 ml"] }
      ]
    },
    {
      name: "Tommy's Margarita",
      families: ["tequila"],
      tags: ["sour", "bright", "sweet"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      roles: [
        { role: "base", amount: ["50 ml", "60 ml"] },
        { role: "lime", amount: ["25 ml", "30 ml"] },
        { role: "syrup", amount: ["15 ml", "20 ml"] }
      ]
    },
    {
      name: "Paloma",
      families: ["tequila"],
      tags: ["bright", "fruity"],
      method: "build",
      serve: "highball",
      glass: "高球杯",
      roles: [
        { role: "base", amount: ["45 ml", "50 ml"] },
        { role: "lime", amount: ["10 ml", "15 ml"] },
        { role: "mixer", amount: ["补满", "90-120 ml"] }
      ]
    },
    {
      name: "Daiquiri",
      families: ["rum"],
      tags: ["sour", "bright"],
      method: "shake",
      serve: "sour",
      glass: "冰镇鸡尾酒杯",
      roles: [
        { role: "base", amount: ["50 ml", "60 ml"] },
        { role: "lime", amount: ["20 ml", "25 ml"] },
        { role: "syrup", amount: ["7.5 ml", "10 ml", "15 ml"] }
      ]
    },
    {
      name: "Mojito / Collins",
      families: ["rum", "gin", "any"],
      tags: ["sour", "bright", "herbal"],
      method: "build",
      serve: "highball",
      glass: "高球杯",
      roles: [
        { role: "base", amount: ["45 ml", "50 ml"] },
        { role: "lime", amount: ["15 ml", "20 ml"] },
        { role: "syrup", amount: ["10 ml", "15 ml"] },
        { role: "mixer", amount: ["补满", "90-120 ml"] }
      ]
    },
    {
      name: "Whiskey Sour",
      families: ["whiskey", "brandy", "any"],
      tags: ["sour", "sweet", "strong"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      strong: true,
      roles: [
        { role: "base", amount: ["50 ml", "60 ml"] },
        { role: "lemon", amount: ["20 ml", "25 ml", "30 ml"] },
        { role: "syrup", amount: ["10 ml", "15 ml"] }
      ]
    },
    {
      name: "Old Fashioned",
      families: ["whiskey", "brandy", "rum"],
      tags: ["strong", "bitter", "smoky"],
      method: "stir",
      serve: "nightcap",
      glass: "古典杯",
      strong: true,
      roles: [
        { role: "base", amount: ["50 ml", "60 ml"] },
        { role: "syrup", amount: ["5 ml", "7.5 ml"] },
        { role: "bitters", amount: ["2 dash", "3 dash"] }
      ]
    },
    {
      name: "Negroni / Boulevardier",
      families: ["gin", "whiskey"],
      tags: ["bitter", "herbal", "strong"],
      method: "stir",
      serve: "stirred",
      glass: "古典杯",
      strong: true,
      roles: [
        { role: "base", amount: ["30 ml"] },
        { role: "bitterLiqueur", amount: ["25 ml", "30 ml"] },
        { role: "vermouth", amount: ["25 ml", "30 ml"] }
      ]
    },
    {
      name: "Martini / Manhattan",
      families: ["gin", "vodka", "whiskey"],
      tags: ["dry", "strong", "herbal"],
      method: "stir",
      serve: "stirred",
      glass: "冰镇鸡尾酒杯",
      strong: true,
      roles: [
        { role: "base", amount: ["50 ml", "60 ml"] },
        { role: "vermouth", amount: ["10 ml", "15 ml", "20 ml"] },
        { role: "bitters", amount: ["1 dash", "2 dash"], optional: true }
      ]
    },
    {
      name: "Spritz",
      families: ["liqueur", "any"],
      tags: ["bitter", "bright", "floral"],
      method: "build",
      serve: "spritz",
      glass: "葡萄酒杯或高球杯",
      roles: [
        { role: "bitterLiqueur", amount: ["45 ml", "60 ml"] },
        { role: "mixer", amount: ["90-120 ml", "补满"] }
      ]
    },
    {
      name: "果茶高球",
      families: ["gin", "vodka", "rum", "tequila", "any"],
      tags: ["sour", "bright", "fruity", "floral"],
      method: "build",
      serve: "highball",
      glass: "高球杯",
      social: true,
      roles: [
        { role: "base", amount: ["30 ml", "40 ml", "45 ml"] },
        { role: "lemon", amount: ["10 ml", "15 ml"] },
        { role: "syrup", amount: ["5 ml", "10 ml"] },
        { role: "teaOrMixer", amount: ["补满", "90-120 ml"] }
      ]
    },
    {
      name: "咖啡汤力",
      families: ["gin", "vodka", "whiskey", "rum", "any"],
      tags: ["bitter", "bright"],
      method: "build",
      serve: "highball",
      glass: "高球杯",
      social: true,
      roles: [
        { role: "base", amount: ["30 ml", "40 ml"] },
        { role: "coffee", amount: ["30 ml", "45 ml"] },
        { role: "mixer", amount: ["90-120 ml", "补满"] }
      ]
    },
    {
      name: "咖啡椰奶 Punch",
      families: ["rum", "whiskey", "vodka", "brandy", "any"],
      tags: ["bitter", "creamy", "sweet"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      social: true,
      roles: [
        { role: "base", amount: ["30 ml", "40 ml"] },
        { role: "coffee", amount: ["30 ml", "45 ml"] },
        { role: "coconutMilk", amount: ["30 ml", "45 ml"] },
        { role: "syrup", amount: ["7.5 ml", "10 ml"] },
        { role: "bitters", amount: ["1 dash", "2 dash"], optional: true }
      ]
    },
    {
      name: "Jungle Bird 变奏",
      families: ["rum", "tequila", "whiskey", "any"],
      tags: ["bitter", "fruity", "sour", "sweet"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      social: true,
      roles: [
        { role: "base", amount: ["35 ml", "45 ml"] },
        { role: "bitterLiqueur", amount: ["15 ml", "20 ml"] },
        { role: "pineappleJuice", amount: ["35 ml", "45 ml"] },
        { role: "lime", amount: ["15 ml", "20 ml"] },
        { role: "demeraraSyrup", amount: ["7.5 ml", "10 ml"] }
      ]
    },
    {
      name: "Paper Plane 变奏",
      families: ["whiskey", "brandy", "rum", "any"],
      tags: ["sour", "bitter", "sweet", "strong"],
      method: "shake",
      serve: "sour",
      glass: "鸡尾酒杯",
      strong: true,
      social: true,
      roles: [
        { role: "base", amount: ["25 ml", "30 ml"] },
        { role: "amaro", amount: ["20 ml", "25 ml", "30 ml"] },
        { role: "bitterLiqueur", amount: ["20 ml", "25 ml", "30 ml"] },
        { role: "lemon", amount: ["20 ml", "25 ml", "30 ml"] }
      ]
    },
    {
      name: "乳酸菌 Sour",
      families: ["vodka", "gin", "rum", "tequila", "any"],
      tags: ["sour", "sweet", "creamy"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      social: true,
      roles: [
        { role: "base", amount: ["40 ml", "45 ml"] },
        { role: "lemon", amount: ["15 ml", "20 ml"] },
        { role: "yogurtMixer", amount: ["45 ml", "60 ml"] }
      ]
    },
    {
      name: "果酱 Sour",
      families: ["gin", "vodka", "rum", "whiskey", "brandy", "any"],
      tags: ["sour", "sweet", "fruity"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      social: true,
      roles: [
        { role: "base", amount: ["45 ml", "50 ml"] },
        { role: "lemon", amount: ["20 ml", "25 ml"] },
        { role: "jamOrSyrup", amount: ["15 ml", "20 ml"] }
      ]
    },
    {
      name: "茶香 Sour",
      families: ["gin", "vodka", "rum", "tequila", "any"],
      tags: ["sour", "bright", "herbal", "floral"],
      method: "shake",
      serve: "sour",
      glass: "鸡尾酒杯或古典杯",
      social: true,
      roles: [
        { role: "base", amount: ["40 ml", "45 ml"] },
        { role: "lemon", amount: ["20 ml", "25 ml"] },
        { role: "teaSyrup", amount: ["15 ml", "20 ml"] }
      ]
    },
    {
      name: "柑橘 Sour",
      families: ["gin", "vodka", "rum", "tequila", "whiskey", "any"],
      tags: ["sour", "bright", "fruity"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      social: true,
      roles: [
        { role: "base", amount: ["45 ml", "50 ml"] },
        { role: "lime", amount: ["15 ml", "20 ml"] },
        { role: "orangeLiqueur", amount: ["10 ml", "15 ml"] },
        { role: "syrup", amount: ["5 ml", "10 ml"], optional: true }
      ]
    },
    {
      name: "苦橙 Sour",
      families: ["gin", "vodka", "whiskey", "rum", "any"],
      tags: ["sour", "bitter", "bright"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      social: true,
      roles: [
        { role: "base", amount: ["40 ml", "45 ml"] },
        { role: "lemon", amount: ["20 ml", "25 ml"] },
        { role: "bitterLiqueur", amount: ["10 ml", "15 ml"] },
        { role: "syrup", amount: ["7.5 ml", "10 ml"] }
      ]
    },
    {
      name: "黄瓜汤力 Cooler",
      families: ["gin", "vodka", "tequila", "rum", "any"],
      tags: ["bright", "sour", "herbal", "dry"],
      method: "build",
      serve: "highball",
      glass: "高球杯",
      social: true,
      roles: [
        { role: "base", amount: ["25 ml", "30 ml", "40 ml"] },
        { role: "cucumber", amount: ["3-5 片", "20 ml"] },
        { role: "lime", amount: ["10 ml", "15 ml"] },
        { role: "syrup", amount: ["5 ml", "7.5 ml"], optional: true },
        { role: "tonicMixer", amount: ["补满", "90-120 ml"] }
      ]
    },
    {
      name: "姜味香料高球",
      families: ["whiskey", "rum", "brandy", "tequila", "any"],
      tags: ["spicy", "bright", "sour"],
      method: "build",
      serve: "highball",
      glass: "高球杯",
      social: true,
      roles: [
        { role: "base", amount: ["25 ml", "30 ml", "40 ml"] },
        { role: "lime", amount: ["10 ml", "15 ml"] },
        { role: "spiceSyrup", amount: ["7.5 ml", "10 ml", "15 ml"] },
        { role: "gingerMixer", amount: ["补满", "90-120 ml"] },
        { role: "bitters", amount: ["1 dash", "2 dash"], optional: true }
      ]
    },
    {
      name: "泰式椰茶 Punch",
      families: ["rum", "tequila", "vodka", "gin", "any"],
      tags: ["bright", "creamy", "herbal", "fruity"],
      method: "build",
      serve: "highball",
      glass: "高球杯",
      social: true,
      roles: [
        { role: "base", amount: ["25 ml", "30 ml", "40 ml"] },
        { role: "lime", amount: ["10 ml", "15 ml"] },
        { role: "coconutMilk", amount: ["30 ml", "45 ml"] },
        { role: "cucumber", amount: ["3-5 片"], optional: true },
        { role: "teaOrMixer", amount: ["补满", "90-120 ml"] }
      ]
    },
    {
      name: "奶洗 Sour",
      families: ["brandy", "rum", "whiskey", "gin", "any"],
      tags: ["sour", "creamy", "sweet"],
      method: "shake",
      serve: "sour",
      glass: "古典杯",
      social: true,
      roles: [
        { role: "base", amount: ["30 ml", "40 ml"] },
        { role: "lemon", amount: ["15 ml", "20 ml"] },
        { role: "milkCream", amount: ["30 ml", "45 ml"] },
        { role: "syrup", amount: ["10 ml", "15 ml"] },
        { role: "bitters", amount: ["1 dash"], optional: true }
      ]
    },
    {
      name: "椰子朗姆高球",
      families: ["rum", "vodka", "tequila", "any"],
      tags: ["sour", "fruity", "sweet", "bright"],
      method: "build",
      serve: "highball",
      glass: "高球杯",
      social: true,
      roles: [
        { role: "base", amount: ["40 ml", "45 ml"] },
        { role: "lime", amount: ["10 ml", "15 ml"] },
        { role: "coconutOrMixer", amount: ["90-120 ml", "补满"] }
      ]
    }
  ];
}

function buildIngredientsFromTemplate({ template, base, modifier, citrus, syrup, mixer, tags, strength }) {
  const picked = [];
  template.roles.forEach((part) => {
    if (part.optional && shouldSkipOptionalIngredient(tags)) return;
    const ingredient = ingredientForRole(part.role, { base, modifier, citrus, syrup, mixer, tags });
    if (!ingredient) return;
    picked.push({ name: ingredient, amount: amountForRole(part.role, part.amount, { template, strength }) });
  });
  return dedupeIngredients(picked);
}

function shouldSkipOptionalIngredient(tags) {
  const count = Array.from(tags).filter((tag) => tag !== "strong").length;
  if (count >= 3) return Math.random() > 0.72;
  if (count >= 2) return Math.random() > 0.62;
  return Math.random() > 0.55;
}

function amountForRole(role, amounts, { template, strength }) {
  if (role !== "base") return sample(amounts);
  if (strength <= 1) return sample(template.method === "build" ? ["20 ml", "25 ml", "30 ml"] : ["20 ml", "25 ml"]);
  if (strength === 2) return sample(template.method === "build" ? ["25 ml", "30 ml", "35 ml"] : ["30 ml", "35 ml"]);
  if (strength === 3) return sample(amounts);
  if (strength === 4) return sample(["45 ml", "50 ml"]);
  return sample(["50 ml", "60 ml"]);
}

function ingredientForRole(role, context) {
  const { base, modifier, citrus, syrup, mixer } = context;
  if (role === "base") return base?.name || "基酒";
  if (role === "lime") return findBottleByWords(["青柠", "lime"], "citrus")?.name || citrus?.name || "青柠汁";
  if (role === "lemon") return findBottleByWords(["柠檬", "lemon"], "citrus")?.name || citrus?.name || "柠檬汁";
  if (role === "syrup") return syrup?.name || "糖浆";
  if (role === "mixer") return mixer?.name || "苏打水";
  if (role === "bitters") return findBottleByWords(["苦精", "bitters"], "bitters")?.name || "苦精";
  if (role === "orangeLiqueur") return findBottleByWords(["君度", "橙", "triple", "cointreau", "curacao", "curaçao"], "liqueur")?.name || modifier?.name || "橙味利口酒";
  if (role === "bitterLiqueur") return findBottleByWords(["金巴利", "campari", "aperol", "苦"], "liqueur")?.name || modifier?.name || "苦味利口酒";
  if (role === "amaro") return findBottleByWords(["阿玛罗", "阿马罗", "amaro", "aperol", "金巴利", "campari"], "liqueur")?.name || modifier?.name || "阿玛罗/草本利口酒";
  if (role === "vermouth") return findBottleByWords(["味美思", "vermouth"], "vermouth")?.name || (modifier?.category === "vermouth" ? modifier.name : "味美思");
  if (role === "teaOrMixer") return findBottleByWords(["茶", "乌龙", "绿茶", "红茶", "茉莉"], "mixer")?.name || mixer?.name || "无糖茶/气泡茶";
  if (role === "teaSyrup") return findBottleByWords(["茶", "乌龙", "绿茶", "红茶", "茉莉"], "syrup")?.name || syrup?.name || "茶糖浆";
  if (role === "coffee") return findBottleByWords(["咖啡", "cold brew", "espresso"], "mixer")?.name || "冷萃咖啡";
  if (role === "yogurtMixer") return findBottleByWords(["养乐多", "乳酸", "酸奶", "yakult"], "mixer")?.name || "乳酸菌饮料";
  if (role === "jamOrSyrup") return findBottleByWords(["果酱", "莓", "桃", "jam"], "syrup")?.name || syrup?.name || "果酱/糖浆";
  if (role === "coconutOrMixer") return findBottleByWords(["椰", "coconut"], "mixer")?.name || mixer?.name || "椰子水/苏打水";
  if (role === "coconutMilk") return findBottleByWords(["椰奶", "椰乳", "椰浆", "coconut milk", "coconut cream"], "mixer")?.name || "椰奶";
  if (role === "pineappleJuice") return findBottleByWords(["菠萝", "凤梨", "pineapple"], null)?.name || "菠萝汁";
  if (role === "demeraraSyrup") return findBottleByWords(["红糖", "黑糖", "demerara"], "syrup")?.name || syrup?.name || "红糖糖浆";
  if (role === "cucumber") return findBottleByWords(["黄瓜", "cucumber"], null)?.name || "黄瓜片/黄瓜汁";
  if (role === "gingerMixer") return findBottleByWords(["姜汁", "姜啤", "ginger"], "mixer")?.name || mixer?.name || "姜汁汽水";
  if (role === "spiceSyrup") return findBottleByWords(["姜", "辣椒", "肉桂", "辛香", "spice"], "syrup")?.name || syrup?.name || "姜糖浆";
  if (role === "tonicMixer") return findBottleByWords(["汤力", "tonic"], "mixer")?.name || mixer?.name || "汤力水";
  if (role === "milkCream") return findBottleByWords(["牛奶", "奶", "鲜奶", "奶油", "milk", "cream"], "mixer")?.name || "牛奶/奶油";
  return null;
}

function findBottleByWords(words, category) {
  return state.bottles.find((item) => (
    (!category || item.category === category) && words.some((word) => item.name.toLowerCase().includes(word))
  ));
}

function dedupeIngredients(ingredients) {
  const seen = new Set();
  return ingredients.filter((item) => {
    const key = item.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function baseFamily(name) {
  const text = name.toLowerCase();
  if (text.includes("龙舌兰") || text.includes("tequila") || text.includes("mezcal")) return "tequila";
  if (text.includes("朗姆") || text.includes("rum")) return "rum";
  if (text.includes("金酒") || text.includes("琴酒") || text.includes("gin")) return "gin";
  if (text.includes("威士忌") || text.includes("波本") || text.includes("whisky") || text.includes("whiskey") || text.includes("bourbon") || text.includes("rye")) return "whiskey";
  if (text.includes("伏特加") || text.includes("vodka")) return "vodka";
  if (text.includes("白兰地") || text.includes("brandy") || text.includes("cognac")) return "brandy";
  if (text.includes("金巴利") || text.includes("利口") || text.includes("liqueur")) return "liqueur";
  return "any";
}

function buildProfile({ prompt, tags, ingredients, template, strength }) {
  const ingredientNames = ingredients.map((item) => item.name).filter(Boolean);
  const baseName = ingredientNames[0] || "这支基酒";
  const accentName = ingredientNames.find((name, index) => index > 0 && !/苏打|气泡|水$|冰/.test(name)) || ingredientNames[1] || "一点余味";
  const family = baseFamily(baseName);
  const templateTitle = template?.social ? "灵感" : "经典";
  const title = profileTitle(tags, family, template);
  const entry = prompt ? `「${prompt}」` : sample(["这个念头", "今晚的杯子", "这组材料", `${baseName}这一杯`]);
  const serveMood = profileServeMood(template);
  const supportNames = ingredientNames.slice(1).filter(Boolean);
  const supportText = formatIngredientList(supportNames.slice(0, 2));

  return {
    title,
    line: buildProfileLine({ entry, baseName, accentName, supportText, tags, template, strength, serveMood, templateTitle })
  };
}

function buildProfileLine({ entry, baseName, accentName, supportText, tags, template, strength, serveMood, templateTitle }) {
  const notes = profileMenuNotes(tags, strength);
  const accentEffect = ingredientEffect(accentName, tags);
  const structure = template?.name || serveMood;
  const support = supportText || accentName;
  const promptLead = entry.startsWith("「") ? `${entry}会被翻成${notes.style}的方向` : `${baseName}做成${notes.style}的${serveMood}`;
  const lines = [
    `以${baseName}为基底，${support}负责${accentEffect}；入口${notes.palate}，收口${notes.finish}。`,
    `${promptLead}：${baseName}保留主体，${accentName}带出${notes.accent}，整体${notes.body}。`,
    `参考${structure}的${templateTitle}结构，${baseName}给酒体，${support}调整酸甜和香气；喝起来${notes.palate}，尾段${notes.finish}。`,
    `这杯更接近${notes.style}的${serveMood}。${accentName}先出现，${baseName}在中段撑住，最后留下${notes.finish}。`,
    `${baseName}的酒感不会被盖掉，${accentName}主要用来${accentEffect}；如果想更顺口，可以先少量加糖再试。`,
    `${entry}不做成纯甜饮，重点放在${notes.accent}、${notes.body}和${notes.finish}之间的平衡。`
  ];
  return sample(lines);
}

function profileMenuNotes(tags, strength) {
  const palate = [];
  const accent = [];
  const finish = [];
  const body = [];
  const style = [];

  if (tags.has("bright")) {
    palate.push("清爽、酸度明确", "入口轻快", "酸度比较明亮");
    accent.push("柑橘感", "清新的酸度", "更干净的入口");
    finish.push("偏干净", "不拖尾", "带一点清爽回味");
    body.push("轻到中等酒体", "不会太厚重", "适合长饮一点");
    style.push("清爽", "明亮", "偏干净");
  }
  if (tags.has("sour")) {
    palate.push("酸甜平衡比较靠前", "第一口酸感明显", "酸度比甜度更醒目");
    accent.push("酸甜结构", "果酸", "更利落的轮廓");
    finish.push("酸感收得快", "收口偏利落", "尾段有轻微回酸");
    body.push("结构清楚", "甜度不高", "更适合摇合");
    style.push("酸酒感", "酸甜型", "利落");
  }
  if (tags.has("sweet")) {
    palate.push("入口更圆润", "甜感柔和", "酸甜更容易入口");
    accent.push("圆润度", "轻微甜香", "更顺滑的口感");
    finish.push("有一点回甜", "收口温和", "不会太尖锐");
    body.push("口感更圆", "甜度中等", "适合降低酸度的锐利感");
    style.push("圆润", "易入口", "甜感适中");
  }
  if (tags.has("bitter")) {
    palate.push("苦味先出来", "入口偏干", "苦甜感明显");
    accent.push("苦橙和草本感", "更干的边缘", "苦味层次");
    finish.push("带微苦回味", "收口偏干", "尾段更长");
    body.push("结构偏成熟", "甜度克制", "适合慢慢喝");
    style.push("偏苦", "干型", "草本感");
  }
  if (tags.has("smoky") || strength >= 4) {
    palate.push("酒感更直接", "入口有重量", "酒体比较集中");
    accent.push("烟熏或木质感", "更深的酒体", "温热感");
    finish.push("尾韵更长", "酒感留得久", "收口偏暖");
    body.push("中等到饱满酒体", "适合短饮", "不太适合一口喝完");
    style.push("酒感型", "偏深", "慢饮");
  }
  if (tags.has("floral") || tags.has("herbal")) {
    palate.push("香气比甜度更明显", "入口有草本感", "味道比较细");
    accent.push("草本和花香", "更高的香气", "植物感");
    finish.push("带一点香气回味", "收口较干净", "草本感留在尾段");
    body.push("酒体不厚", "香气主导", "适合做得偏干");
    style.push("草本", "花香", "香气型");
  }
  if (tags.has("fruity")) {
    palate.push("果味明显", "入口有果香", "酸甜里有果味支撑");
    accent.push("果香", "果酸", "果皮感");
    finish.push("果香轻轻回落", "尾段有果味", "收口不算干");
    body.push("中等甜度", "适合加冰", "比较容易入口");
    style.push("果味型", "明快", "酸甜果香");
  }
  if (strength <= 2) {
    palate.push("酒感较轻", "入口压力不大", "适合慢慢喝");
    accent.push("稀释感和清爽度", "更低的酒精存在感", "气泡或冰感");
    finish.push("收口轻", "余味短", "不会压住味觉");
    body.push("轻酒体", "适合长饮", "更偏日常");
    style.push("低酒感", "轻盈", "长饮感");
  }

  const fallback = {
    palate: ["入口平衡", "味道比较均衡", "第一口不会太冲"],
    accent: ["材料之间的层次", "基础酸甜", "酒体和香气的平衡"],
    finish: ["收口清楚", "尾韵适中", "余味不复杂"],
    body: ["中等酒体", "整体耐喝", "不会太极端"],
    style: ["平衡", "耐喝", "经典感"]
  };

  return {
    palate: sample(palate.length ? palate : fallback.palate),
    accent: sample(accent.length ? accent : fallback.accent),
    finish: sample(finish.length ? finish : fallback.finish),
    body: sample(body.length ? body : fallback.body),
    style: sample(style.length ? style : fallback.style)
  };
}

function ingredientEffect(name = "", tags) {
  const text = name.toLowerCase();
  if (text.includes("柠檬") || text.includes("青柠") || text.includes("lemon") || text.includes("lime")) return sample(["提高酸度", "把入口提亮", "让酒体更利落"]);
  if (text.includes("糖") || text.includes("蜜") || text.includes("syrup") || text.includes("honey")) return sample(["补足甜感", "增加圆润度", "平衡酸度"]);
  if (text.includes("苏打") || text.includes("气泡") || text.includes("tonic") || text.includes("soda")) return sample(["拉长口感", "降低酒精冲击", "带来气泡和清爽度"]);
  if (text.includes("咖啡") || text.includes("coffee") || text.includes("espresso")) return sample(["增加烘焙苦香", "带来咖啡的苦味", "压低整体甜感"]);
  if (text.includes("茶")) return sample(["增加茶感和干爽度", "带来轻微单宁", "让收口更清"]);
  if (text.includes("金巴利") || text.includes("campari") || text.includes("苦")) return sample(["提供苦味骨架", "增加苦橙感", "让结构更干"]);
  if (text.includes("味美思") || text.includes("vermouth")) return sample(["带出草本和酒体", "增加香气层次", "让酒感更完整"]);
  if (text.includes("椰")) return sample(["增加椰香和柔和感", "让口感更顺", "带来热带风味"]);
  if (tags.has("bitter")) return "增加苦味层次";
  if (tags.has("sour")) return "调整酸甜平衡";
  if (tags.has("sweet")) return "增加圆润度";
  return sample(["补充香气", "调整整体平衡", "让味道更完整"]);
}

function formatIngredientList(names) {
  const clean = names.filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  return `${clean[0]}和${clean[1]}`;
}

function profileTitle(tags, family, template) {
  if (template?.name?.includes("Negroni") || tags.has("bitter")) return "苦橙";
  if (tags.has("smoky") || family === "whiskey") return "午夜";
  if (tags.has("floral") || tags.has("herbal") || family === "gin") return "花园";
  if (tags.has("fruity") || tags.has("sweet")) return "日落";
  if (family === "tequila") return "沙漠";
  if (family === "rum") return "海岛";
  if (family === "vodka") return "冷光";
  return template?.social ? "灵感" : "经典";
}

function profileServeMood(template) {
  if (!template) return "混合";
  if (template.serve === "highball") return sample(["高球", "气泡", "长饮"]);
  if (template.serve === "sour") return sample(["酸酒", "摇合短饮", "酸甜结构"]);
  if (template.serve === "spritz") return sample(["Spritz", "轻苦气泡", "日落长饮"]);
  if (template.serve === "stirred") return sample(["搅拌短饮", "冷杯短饮", "低温结构"]);
  if (template.serve === "nightcap") return sample(["夜饮", "收尾酒", "慢饮"]);
  return template.name || "混合";
}

function decideServeMode(tags, selectedMode, strength) {
  const templates = [
    {
      id: "highball",
      label: "高球",
      glass: "高球杯",
      long: true,
      shaken: false,
      stirred: false,
      weight: 3 + (tags.has("bright") ? 5 : 0) + (strength <= 2 ? 3 : 0)
    },
    {
      id: "sour",
      label: "酸酒",
      glass: "古典杯或鸡尾酒杯",
      long: false,
      shaken: true,
      stirred: false,
      weight: 2 + (tags.has("sour") ? 5 : 0) + (tags.has("fruity") ? 3 : 0)
    },
    {
      id: "spritz",
      label: "Spritz",
      glass: "葡萄酒杯或高球杯",
      long: true,
      shaken: false,
      stirred: false,
      weight: 2 + (tags.has("bitter") ? 4 : 0) + (tags.has("floral") ? 2 : 0)
    },
    {
      id: "stirred",
      label: "搅拌短饮",
      glass: "冰镇鸡尾酒杯或古典杯",
      long: false,
      shaken: false,
      stirred: true,
      weight: 2 + (tags.has("dry") ? 4 : 0) + (tags.has("strong") ? 3 : 0)
    },
    {
      id: "nightcap",
      label: "夜饮",
      glass: "古典杯",
      long: false,
      shaken: false,
      stirred: true,
      weight: 1 + (tags.has("smoky") ? 5 : 0) + (strength >= 4 ? 3 : 0)
    }
  ];

  if (selectedMode === "long") return randomizeServe(templates.find((item) => item.id === "highball"));
  if (selectedMode === "short") return randomizeServe(sample(templates.filter((item) => !item.long)));
  if (selectedMode === "stirred") return randomizeServe(sample(templates.filter((item) => item.stirred)));
  if (selectedMode === "shaken") return randomizeServe(templates.find((item) => item.id === "sour"));
  return randomizeServe(weightedPick(templates.map((item) => ({ item, weight: item.weight }))));
}

function buildIngredients({ base, modifier, citrus, syrup, mixer, tags, strength, serve }) {
  const ingredients = [
    { name: base?.name || "你最想消耗的一款基酒", amount: randomBaseAmount(strength, serve) }
  ];

  const usesModifier = Boolean(modifier) && (serve.id !== "highball" || Math.random() > 0.28);
  if (usesModifier) {
    ingredients.push({ name: modifier.name, amount: modifier.category === "bitters" ? sample(["1 dash", "2 dash", "3 dash"]) : sample(["10 ml", "15 ml", "20 ml", "22.5 ml"]) });
  }

  if (serve.id === "sour" || tags.has("sour") || (tags.has("bright") && Math.random() > 0.35) || (tags.has("fruity") && Math.random() > 0.45)) {
    ingredients.push({ name: citrus?.name || sample(["柠檬汁", "青柠汁"]), amount: sample(["15 ml", "20 ml", "22.5 ml", "25 ml"]) });
  }

  if (serve.id === "sour" || tags.has("sweet") || tags.has("fruity") || (tags.has("sour") && Math.random() > 0.2)) {
    const sweetAmount = tags.has("sweet") ? sample(["10 ml", "15 ml", "20 ml"]) : sample(["5 ml", "7.5 ml", "10 ml", "12.5 ml"]);
    ingredients.push({ name: syrup?.name || sample(["糖浆", "蜂蜜水"]), amount: sweetAmount });
  }

  if ((tags.has("bitter") || serve.id === "nightcap") && !modifier?.tags.includes("bitter") && Math.random() > 0.25) {
    ingredients.push({ name: "苦精", amount: sample(["1 dash", "2 dash"]) });
  }

  if (serve.long) {
    ingredients.push({ name: mixer?.name || sample(["苏打水", "汤力水", "气泡水"]), amount: sample(["补满", "60-90 ml", "90-120 ml"]) });
  }

  return ingredients;
}

function buildSteps(serve, profile) {
  if (serve.id === "spritz") {
    return [
      "杯中加满冰块。",
      "先倒入酒和风味材料，轻轻搅 3 圈。",
      "沿杯壁加入气泡材料，保留一点层次。",
      "放上装饰，喝前轻轻提拉一次。"
    ];
  }

  if (serve.long) {
    return [
      "杯中加满冰块。",
      sample(["倒入除气泡饮料外的所有材料，轻轻搅匀。", "先倒入基酒和酸甜材料，快速搅 5 秒。"]),
      "补满气泡饮料，再轻提搅拌 2 次。",
      sample(["放上装饰，先闻香气再喝。", "最后挤一片柑橘皮，让第一口更亮。"])
    ];
  }

  if (serve.stirred) {
    return [
      "调酒杯中加入所有材料和足量冰块。",
      "稳定搅拌 18-25 秒，让酒体降温并变得顺滑。",
      "滤入冰镇杯中。",
      `放上装饰，喝第一口时感受它的${profile.title}感。`
    ];
  }

  return [
    "摇壶中加入所有材料和足量冰块。",
    sample(["用力摇合 10-12 秒，直到壶身冰冷。", "快速摇合 8-10 秒，让酸甜更轻盈。"]),
    "滤入冰镇杯中。",
    sample(["放上装饰，先喝一小口再微调酸甜。", `放上装饰，让它保留一点${profile.title}的尾韵。`])
  ];
}

function buildRecipeName({ prompt, profile, ingredients, serve, tags, template }) {
  const ingredientNames = ingredients.map((item) => item.name).filter(Boolean);
  const base = conciseIngredientName(ingredientNames[0] || "基酒");
  const accent = conciseIngredientName(bestNameAccent(ingredientNames, tags));
  const style = recipeStyleName(template, serve, ingredientNames);
  const baseStyle = baseSpiritLabel(ingredientNames[0] || base);
  const promptCue = promptNameCue(prompt, tags);
  const menuCue = menuNameCue(tags, ingredientNames);
  const classic = template?.name || style;
  const hasNamedAccent = accent && accent !== base && !["苏打", "气泡", "水", "基酒"].includes(accent);

  const directNames = [
    `${base}${style}`,
    hasNamedAccent ? `${accent}${style}` : "",
    hasNamedAccent ? `${base}${accent}${style}` : "",
    `${baseStyle}${style}`,
    hasNamedAccent ? `${accent}${baseStyle}` : ""
  ];
  const riffNames = [
    `${classic}变奏`,
    `${baseStyle}${classic}`,
    hasNamedAccent ? `${accent}${classic}` : "",
    `${menuCue}${style}`,
    promptCue ? `${promptCue}${style}` : ""
  ];
  const houseNames = [
    `家中${baseStyle}`,
    `今日${style}`,
    hasNamedAccent ? `${accent}家常调` : "",
    promptCue ? `${promptCue}调` : "",
    `${menuCue}${baseStyle}`
  ];

  const mode = weightedPick([
    { item: "direct", weight: 7 },
    { item: "riff", weight: 4 },
    { item: "house", weight: 2 }
  ]);

  const direct = validNames(directNames, 3, 12, ingredientNames);
  const riff = validNames(riffNames, 3, 12, ingredientNames);
  const house = validNames(houseNames, 3, 10, ingredientNames);
  if (mode === "direct") return sample(direct.length ? direct : [...riff, ...house]);
  if (mode === "riff") return sample(riff.length ? riff : direct);
  return sample(house.length ? house : direct);
}

function buildAbstractRecipeName({ prompt, ingredients, serve, tags }) {
  const ingredientNames = ingredients.map((item) => item.name).filter(Boolean);
  const spirit = spiritImage(ingredientNames[0]);
  const modifier = modifierImage(ingredientNames[1], tags);
  const clues = drinkNameClues(ingredientNames);
  const promptImage = promptToImage(prompt, tags);
  const texture = sample(textureWords(tags));
  const gesture = sample(gestureWords(serve));
  const place = sample(placeWords(tags));
  const mood = sample(moodWords(tags));
  const object = sample(objectWords(serve, tags));
  const verb = sample(poeticVerbs(serve, tags));
  const shortName = sample(shortNameWords(tags));
  const tinyName = sample(tinyNameWords(tags));
  const oneCharNames = filterConsistentNames([...tinyNameWords(tags), ...clues.tiny], ingredientNames);
  const compactNames = validNames([
    ...clues.short,
    shortName,
    sample(shortNameWords(tags)),
    `${tinyName}${texture}`,
    `${tinyName}${modifier.slice(0, 1)}`,
    `${spirit.slice(0, 2)}${tinyName}`,
    `${clues.tiny[0] || tinyName}${texture}`,
    `${clues.tiny[0] || tinyName}${modifier.slice(0, 1)}`,
    `${place.slice(0, 2)}${mood.slice(0, 2)}`,
    `${object.slice(0, 2)}${tinyName}`,
    promptImage.length <= 4 ? promptImage : ""
  ], 2, 4, ingredientNames);
  const phraseNames = validNames([
    ...clues.phrase,
    `${promptImage}${verb}`,
    `${spirit}遇见${object}`,
    `${modifier}${gesture}`,
    `${place}${mood}`,
    `${object}借走${spirit}`,
    `${promptImage}，${spirit}`,
    `${texture}${modifier}`,
    `${spirit}小夜曲`,
    `${place}收到${modifier}`
  ], 5, 12, ingredientNames);
  const mode = weightedPick([
    { item: "one", weight: 1 },
    { item: "compact", weight: 6 },
    { item: "phrase", weight: 3 }
  ]);
  if (mode === "one") return sample(oneCharNames.length ? oneCharNames : tinyNameWords(tags));
  if (mode === "compact") return sample(compactNames.length ? compactNames : oneCharNames);
  return sample(phraseNames.length ? phraseNames : compactNames);
}

function bestNameAccent(ingredientNames, tags) {
  const preferred = ingredientNames.slice(1).find((name) => {
    const text = name.toLowerCase();
    if (/苏打|气泡|水$|补满|冰/.test(name)) return false;
    if (tags.has("sour") && /柠檬|青柠|lemon|lime/.test(text)) return true;
    if (tags.has("bitter") && /金巴利|苦|campari|bitters/.test(text)) return true;
    if (tags.has("sweet") && /糖|蜜|syrup|honey|果酱/.test(text)) return true;
    if (tags.has("fruity") && /桃|莓|橙|苹果|葡萄|果/.test(text)) return true;
    if (tags.has("floral") || tags.has("herbal")) return /茶|花|玫瑰|草|薄荷|vermouth|味美思/.test(text);
    return true;
  });
  return preferred || ingredientNames[1] || "";
}

function conciseIngredientName(name = "") {
  return name
    .replace(/汁|糖浆|水|饮料|利口酒|苦味|无糖|气泡|冷萃/g, "")
    .replace(/\/.*/g, "")
    .replace(/\s+/g, "")
    .slice(0, 4);
}

function baseSpiritLabel(name = "") {
  const family = baseFamily(name);
  const labels = {
    tequila: "龙舌兰",
    rum: "朗姆",
    gin: "金酒",
    whiskey: "威士忌",
    vodka: "伏特加",
    brandy: "白兰地",
    liqueur: "利口"
  };
  return labels[family] || conciseIngredientName(name) || "基酒";
}

function recipeStyleName(template, serve, ingredientNames) {
  const text = `${template?.name || ""} ${ingredientNames.join(" ")}`.toLowerCase();
  if (text.includes("margarita")) return "玛格丽特";
  if (text.includes("negroni")) return "尼格罗尼";
  if (text.includes("martini")) return "马天尼";
  if (text.includes("old fashioned")) return "古典";
  if (text.includes("mojito")) return "莫吉托";
  if (text.includes("tom collins") || text.includes("collins")) return "柯林斯";
  if (text.includes("gin tonic") || text.includes("tonic") || text.includes("汤力")) return "汤力";
  if (text.includes("spritz")) return "Spritz";
  if (text.includes("sour") || serve.id === "sour") return "酸";
  if (text.includes("茶")) return "茶高球";
  if (text.includes("咖啡")) return "咖啡调";
  if (serve.id === "highball") return "高球";
  if (serve.id === "stirred") return "短饮";
  if (serve.id === "nightcap") return "夜饮";
  return serve.label || "调酒";
}

function promptNameCue(prompt, tags) {
  const text = prompt.trim();
  const rules = [
    [["海", "浪", "蓝"], "海边"],
    [["雨", "湿"], "雨天"],
    [["夜", "晚", "睡"], "夜晚"],
    [["夏", "热"], "夏日"],
    [["烦", "生气", "雷"], "坏脾气"],
    [["甜", "可爱"], "甜口"],
    [["苦", "冷"], "干口"],
    [["花", "香"], "花香"]
  ];
  const matched = rules.find(([keywords]) => keywords.some((keyword) => text.includes(keyword)));
  if (matched) return matched[1];
  if (text) return text.slice(0, 4);
  if (tags.has("bright")) return "清爽";
  if (tags.has("bitter")) return "微苦";
  if (tags.has("smoky")) return "烟熏";
  if (tags.has("fruity")) return "果味";
  return "";
}

function menuNameCue(tags, ingredientNames) {
  const text = ingredientNames.join(" ").toLowerCase();
  if (text.includes("咖啡")) return "咖啡";
  if (text.includes("茶")) return "茶香";
  if (text.includes("椰")) return "椰香";
  if (text.includes("青柠") || text.includes("lime")) return "青柠";
  if (text.includes("柠檬") || text.includes("lemon")) return "柠檬";
  if (tags.has("bitter")) return "微苦";
  if (tags.has("bright")) return "清爽";
  if (tags.has("fruity")) return "果味";
  if (tags.has("floral")) return "花香";
  if (tags.has("smoky")) return "烟熏";
  return "家常";
}

function drinkNameClues(ingredientNames) {
  const text = ingredientNames.join(" ").toLowerCase();
  const clues = {
    tiny: [],
    short: [],
    phrase: []
  };

  const add = (tiny, short, phrase) => {
    clues.tiny.push(...tiny);
    clues.short.push(...short);
    clues.phrase.push(...phrase);
  };

  if (text.includes("龙舌兰") || text.includes("tequila") || text.includes("mezcal")) {
    add(["盐", "刺", "漠", "青"], ["蓝盐", "沙盐", "青刺", "日晒"], ["盐误会月亮", "仙人掌迟到", "青柠晒太阳"]);
  }
  if (text.includes("金酒") || text.includes("琴酒") || text.includes("gin")) {
    add(["松", "绿", "针", "雾"], ["杜松", "绿雾", "针叶", "草信"], ["杜松借走月亮", "绿雾不回家", "草本收到白昼"]);
  }
  if (text.includes("朗姆") || text.includes("rum")) {
    add(["糖", "帆", "岛", "浪"], ["糖岛", "白帆", "浪糖", "椰影"], ["白帆睡着", "糖岛收到月亮", "海风借走玻璃"]);
  }
  if (text.includes("威士忌") || text.includes("波本") || text.includes("whisky") || text.includes("whiskey") || text.includes("bourbon")) {
    add(["琥", "桶", "麦", "烬"], ["琥珀", "木桶", "麦火", "余烬"], ["木桶低声燃烧", "琥珀保持沉默", "麦芽不回家"]);
  }
  if (text.includes("伏特加") || text.includes("vodka")) {
    add(["雪", "冰", "透", "极"], ["雪线", "冰原", "透明", "极光"], ["雪线短路", "透明误会玻璃", "极光睡着"]);
  }
  if (text.includes("白兰地") || text.includes("brandy") || text.includes("cognac")) {
    add(["葡", "铜", "暖", "皮"], ["铜色", "葡梦", "果皮", "暖雾"], ["铜色落日", "葡萄旧梦", "果皮收到月亮"]);
  }
  if (text.includes("金巴利") || text.includes("campari") || text.includes("苦味利口")) {
    add(["苦", "红", "橙", "暗"], ["苦橙", "红月", "暗号", "橙雾"], ["苦橙保持沉默", "红月写错暗号", "橙皮轻轻叛逃"]);
  }
  if (text.includes("咖啡") || text.includes("coffee")) {
    add(["啡", "黑"], ["冷萃", "黑泡"], ["冷萃晒太阳", "黑泡不回家"]);
  }
  if (text.includes("乳酸") || text.includes("酸奶") || text.includes("养乐多")) {
    add(["乳", "白"], ["乳白", "酸白"], ["乳白轻轻发酸", "酸白睡着"]);
  }
  if (text.includes("椰")) {
    add(["椰"], ["椰影", "椰风"], ["椰影借走白昼"]);
  }

  if (!clues.tiny.length) {
    add(["杯"], ["杯底", "酒影"], ["杯底收到月亮"]);
  }

  return clues;
}

function promptToImage(prompt, tags) {
  const text = prompt.trim();
  if ((text.includes("海") || text.includes("浪") || text.includes("蓝")) && (text.includes("雷") || text.includes("生气") || text.includes("暴躁"))) {
    return sample(["海王星小发雷霆", "潮汐在发火", "蓝色雷雨"]);
  }

  const rules = [
    [["海", "浪", "蓝"], ["海王星", "潮汐", "蓝洞", "退潮之后"]],
    [["雷", "生气", "烦", "暴躁"], ["小发雷霆", "云层短路", "雷雨小剧场"]],
    [["雨", "湿"], ["雨后玻璃", "湿漉漉的月亮", "雨巷回声"]],
    [["夜", "晚", "睡"], ["午夜电台", "凌晨两点", "夜色折叠"]],
    [["夏", "热"], ["夏日逃逸", "晒过的风", "午后白光"]],
    [["甜", "可爱"], ["小糖霜", "粉色失重", "软糖星球"]],
    [["苦", "冷"], ["苦橙暗号", "冷山", "薄冰"]],
    [["花", "香"], ["花园迷航", "花影", "玫瑰低语"]]
  ];

  const matched = rules.find(([keywords]) => keywords.some((keyword) => text.includes(keyword)));
  if (matched) return sample(matched[1]);
  if (text) return sample([`${text.slice(0, 4)}梦`, `${text.slice(0, 3)}回声`, `${text.slice(0, 3)}星球`]);
  if (tags.has("smoky")) return "烟影";
  if (tags.has("floral")) return "花影";
  if (tags.has("bitter")) return "苦橙暗号";
  if (tags.has("fruity")) return "果园边境";
  if (tags.has("bright")) return sample(["白昼", "气泡", "亮岛", "清光"]);
  return sample(["浮光", "玻璃", "半梦", "低潮"]);
}

function spiritImage(name = "") {
  const text = name.toLowerCase();
  if (text.includes("龙舌兰") || text.includes("tequila")) return sample(["仙人掌月光", "沙漠星盐", "白日龙舌兰"]);
  if (text.includes("金酒") || text.includes("gin")) return sample(["杜松绿雾", "绿玻璃", "森林针叶"]);
  if (text.includes("朗姆") || text.includes("rum")) return sample(["白帆", "糖岛", "海风朗姆"]);
  if (text.includes("威士忌") || text.includes("whisky") || text.includes("whiskey") || text.includes("波本")) return sample(["琥珀小火", "木桶黄昏", "麦芽余烬"]);
  if (text.includes("伏特加") || text.includes("vodka")) return sample(["雪线", "透明极光", "冰原"]);
  if (text.includes("白兰地") || text.includes("brandy")) return sample(["葡萄旧梦", "铜色落日", "果皮壁炉"]);
  return sample(["玻璃心事", "微醺行星", "透明小船"]);
}

function modifierImage(name = "", tags) {
  const text = name.toLowerCase();
  if (text.includes("金巴利") || text.includes("campari")) return "苦橙红月";
  if (text.includes("君度") || text.includes("cointreau")) return "橙皮闪电";
  if (text.includes("味美思") || text.includes("vermouth")) return "草本信笺";
  if (text.includes("蜜瓜")) return "绿色小行星";
  if (tags.has("bitter")) return "苦味暗号";
  if (tags.has("floral")) return "花香低语";
  if (tags.has("fruity")) return "果味潮汐";
  return "透明回声";
}

function textureWords(tags) {
  const words = ["回声", "失重", "微光", "折叠", "漂流", "低语"];
  if (tags.has("smoky")) words.push("余烬", "烟幕");
  if (tags.has("bitter")) words.push("暗号", "苦边");
  if (tags.has("bright")) words.push("闪光", "白昼");
  if (tags.has("floral")) words.push("花影", "香气");
  return words;
}

function tinyNameWords(tags) {
  const words = ["潮", "雾", "蓝", "月", "刺", "冷", "浮", "醒", "裂", "澄"];
  if (tags.has("smoky")) words.push("烬", "灰", "烟");
  if (tags.has("bitter")) words.push("苦", "暗", "橙");
  if (tags.has("floral")) words.push("花", "影", "香");
  if (tags.has("fruity")) words.push("桃", "莓", "果");
  if (tags.has("strong")) words.push("烈", "火", "晕");
  if (tags.has("spicy")) words.push("雷");
  return words;
}

function shortNameWords(tags) {
  const words = ["月噪", "冷泡", "小失眠", "退潮", "玻璃雨", "半颗星", "风暴糖", "杯底月"];
  if (tags.has("bright")) words.push("白昼", "气泡信", "亮岛");
  if (tags.has("smoky")) words.push("余烬", "烟色", "木星灰");
  if (tags.has("bitter")) words.push("苦橙", "红暗号", "薄冰");
  if (tags.has("floral")) words.push("花影", "玫瑰误差", "香气");
  if (tags.has("fruity")) words.push("果壳", "桃色逃跑", "莓雨");
  if (tags.has("spicy")) words.push("微雷");
  return words;
}

function gestureWords(serve) {
  if (serve.id === "highball") return ["冒泡", "升空", "漂流"];
  if (serve.id === "sour") return ["眨眼", "翻涌", "轻轻发酸"];
  if (serve.id === "spritz") return ["日光漫游", "气泡逃跑", "轻轻旋转"];
  if (serve.id === "nightcap") return ["低声燃烧", "慢慢坠落", "夜里发亮"];
  return ["冷冷转身", "玻璃回旋", "安静发光"];
}

function placeWords(tags) {
  const words = ["海王星", "月背面", "小彗星", "蓝色卫星", "玻璃星云", "杯底剧场"];
  if (tags.has("smoky")) words.push("烟幕边境", "木桶深处");
  if (tags.has("floral")) words.push("花园背面", "玫瑰小路");
  if (tags.has("bitter")) words.push("苦橙车站", "红色黄昏");
  if (tags.has("bright")) words.push("白昼码头", "气泡海岸");
  return words;
}

function moodWords(tags) {
  const words = ["迟到", "短路", "失眠", "漂移", "轻轻叛逃", "突然透明"];
  if (tags.has("strong")) words.push("假装冷静", "慢慢燃烧");
  if (tags.has("sweet")) words.push("偷吃糖霜", "软着陆");
  if (tags.has("sour")) words.push("眨了一下眼", "酸得很礼貌");
  if (tags.has("bitter")) words.push("保持沉默", "写错暗号");
  return words;
}

function objectWords(serve, tags) {
  const words = ["月亮", "玻璃", "口袋风暴", "小宇宙", "蓝色便签", "一枚冷光"];
  if (serve.long) words.push("气泡", "一阵风", "午后");
  if (serve.stirred) words.push("银匙", "冰冷圆周", "安静转身");
  if (tags.has("smoky")) words.push("余烬", "烟灰色梦");
  if (tags.has("floral")) words.push("花影", "香气信封");
  return words;
}

function poeticVerbs(serve, tags) {
  const words = ["迟到", "逃跑", "翻涌", "睡着", "短路", "轻轻爆炸", "假装没事"];
  if (serve.long) words.push("冒泡", "升空");
  if (serve.stirred) words.push("绕圈", "冷静发光");
  if (tags.has("bitter")) words.push("写暗号");
  if (tags.has("bright")) words.push("晒太阳");
  return words;
}

function cleanRecipeName(name) {
  return name
    .replace(/\s+/g, "")
    .replace(/的/g, "")
    .replace(/里的/g, "")
    .replace(/，，/g, "，")
    .replace(/长长/g, "")
    .replace(/下$/g, "");
}

function validNames(names, min, max, ingredientNames = []) {
  const seen = new Set();
  return names
    .map(cleanRecipeName)
    .filter((name) => name.length >= min && name.length <= max)
    .filter((name) => nameMatchesIngredients(name, ingredientNames))
    .filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

function filterConsistentNames(names, ingredientNames) {
  return names.filter((name) => nameMatchesIngredients(name, ingredientNames));
}

function nameMatchesIngredients(name, ingredientNames) {
  const text = ingredientNames.join(" ").toLowerCase();
  const rules = [
    { words: ["盐", "沙盐", "蓝盐", "仙人掌"], ingredients: ["盐", "龙舌兰", "tequila", "mezcal"] },
    { words: ["杜松", "针叶"], ingredients: ["金酒", "琴酒", "gin"] },
    { words: ["椰"], ingredients: ["椰", "coconut"] },
    { words: ["咖啡", "冷萃", "啡", "黑泡"], ingredients: ["咖啡", "coffee", "cold brew", "espresso"] }
  ];
  return rules.every((rule) => {
    const usesStrongWord = rule.words.some((word) => name.includes(word));
    if (!usesStrongWord) return true;
    return rule.ingredients.some((word) => text.includes(word));
  });
}

function buildRecipeArt(name, tags, serve) {
  const seed = hashString(`${name}-${Date.now()}-${Math.random()}`);
  const random = seededRandom(seed);
  const palette = artPalette(tags, random);
  const style = weightedPick([
    { item: "orbit", weight: 2 },
    { item: "ripples", weight: 2 },
    { item: "shards", weight: 2 },
    { item: "window", weight: 1.5 },
    { item: "mist", weight: 1.5 }
  ]);
  const angle = Math.round(random() * 360);
  const symbol = sampleWithRandom(serve.long ? ["○", "◌", "◦"] : serve.stirred ? ["◐", "◒", "◓"] : ["✦", "✧", "×"], random);
  const marks = buildArtMarks({ style, palette, random, serve, seed, symbol });

  return `
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="g${seed}" x1="${random().toFixed(2)}" y1="0" x2="${random().toFixed(2)}" y2="1">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="${Math.round(38 + random() * 28)}%" stop-color="${palette[1]}"/>
          <stop offset="100%" stop-color="${palette[2]}"/>
        </linearGradient>
        <filter id="blur${seed}">
          <feGaussianBlur stdDeviation="${(2 + random() * 5).toFixed(1)}"/>
        </filter>
      </defs>
      <rect width="120" height="120" rx="24" fill="url(#g${seed})"/>
      <g transform="rotate(${angle} 60 60)">${marks}</g>
    </svg>
  `;
}

function buildArtMarks({ style, palette, random, serve, seed, symbol }) {
  if (style === "orbit") {
    const paths = Array.from({ length: 2 + Math.floor(random() * 3) }, () => {
      const rx = Math.round(18 + random() * 32);
      const ry = Math.round(8 + random() * 26);
      const rot = Math.round(random() * 180);
      return `<ellipse cx="${Math.round(42 + random() * 36)}" cy="${Math.round(42 + random() * 36)}" rx="${rx}" ry="${ry}" fill="none" stroke="${sampleWithRandom(palette, random)}" stroke-width="${(1.5 + random() * 3).toFixed(1)}" opacity="${(0.5 + random() * 0.38).toFixed(2)}" transform="rotate(${rot} 60 60)"/>`;
    }).join("");
    return `${softLights(palette, random, seed)}${paths}<text x="60" y="70" text-anchor="middle" font-size="${20 + Math.round(random() * 12)}" font-weight="850" fill="rgba(255,255,255,0.86)">${symbol}</text>`;
  }

  if (style === "ripples") {
    return Array.from({ length: 5 + Math.floor(random() * 5) }, (_, index) => {
      const r = 8 + index * (5 + random() * 3);
      return `<circle cx="${Math.round(44 + random() * 32)}" cy="${Math.round(42 + random() * 34)}" r="${r.toFixed(1)}" fill="none" stroke="${sampleWithRandom(palette, random)}" stroke-width="${(1 + random() * 2.8).toFixed(1)}" opacity="${(0.22 + random() * 0.48).toFixed(2)}"/>`;
    }).join("") + `<path d="${randomCurve(random)}" fill="none" stroke="rgba(255,255,255,0.76)" stroke-width="${serve.long ? 4 : 2.5}" stroke-linecap="round"/>`;
  }

  if (style === "shards") {
    return Array.from({ length: 5 + Math.floor(random() * 7) }, () => {
      const x = Math.round(12 + random() * 82);
      const y = Math.round(12 + random() * 82);
      const points = `${x},${y} ${x + Math.round(8 + random() * 24)},${y + Math.round(random() * 18)} ${x + Math.round(random() * 18)},${y + Math.round(12 + random() * 28)}`;
      return `<polygon points="${points}" fill="${sampleWithRandom(palette, random)}" opacity="${(0.35 + random() * 0.5).toFixed(2)}"/>`;
    }).join("") + `<circle cx="${Math.round(35 + random() * 50)}" cy="${Math.round(35 + random() * 50)}" r="${Math.round(5 + random() * 10)}" fill="rgba(255,255,255,0.8)"/>`;
  }

  if (style === "window") {
    const rects = Array.from({ length: 3 + Math.floor(random() * 5) }, () => (
      `<rect x="${Math.round(8 + random() * 76)}" y="${Math.round(8 + random() * 76)}" width="${Math.round(14 + random() * 34)}" height="${Math.round(8 + random() * 30)}" rx="${Math.round(random() * 10)}" fill="${sampleWithRandom(palette, random)}" opacity="${(0.32 + random() * 0.48).toFixed(2)}"/>`
    )).join("");
    return `${rects}<line x1="${Math.round(10 + random() * 28)}" y1="${Math.round(20 + random() * 80)}" x2="${Math.round(82 + random() * 28)}" y2="${Math.round(20 + random() * 80)}" stroke="rgba(255,255,255,0.72)" stroke-width="${(2 + random() * 5).toFixed(1)}" stroke-linecap="round"/>`;
  }

  return `${softLights(palette, random, seed)}${Array.from({ length: 8 + Math.floor(random() * 8) }, () => (
    `<circle cx="${Math.round(6 + random() * 108)}" cy="${Math.round(6 + random() * 108)}" r="${Math.round(2 + random() * 18)}" fill="${sampleWithRandom(palette, random)}" opacity="${(0.18 + random() * 0.42).toFixed(2)}" filter="url(#blur${seed})"/>`
  )).join("")}<path d="${randomCurve(random)}" fill="none" stroke="rgba(255,255,255,0.64)" stroke-width="${(1.5 + random() * 3).toFixed(1)}" stroke-linecap="round"/>`;
}

function softLights(palette, random, seed) {
  return Array.from({ length: 2 + Math.floor(random() * 4) }, () => (
    `<circle cx="${Math.round(12 + random() * 96)}" cy="${Math.round(12 + random() * 96)}" r="${Math.round(10 + random() * 30)}" fill="${sampleWithRandom(palette, random)}" opacity="${(0.26 + random() * 0.35).toFixed(2)}" filter="url(#blur${seed})"/>`
  )).join("");
}

function randomCurve(random) {
  return `M ${Math.round(8 + random() * 26)} ${Math.round(20 + random() * 78)} C ${Math.round(30 + random() * 24)} ${Math.round(6 + random() * 38)}, ${Math.round(56 + random() * 28)} ${Math.round(58 + random() * 42)}, ${Math.round(88 + random() * 24)} ${Math.round(14 + random() * 88)}`;
}

function artPalette(tags, random) {
  const hueAnchors = [];
  if (tags.has("bright")) hueAnchors.push(175, 195, 48);
  if (tags.has("bitter")) hueAnchors.push(8, 24, 342);
  if (tags.has("floral")) hueAnchors.push(286, 318, 332);
  if (tags.has("fruity")) hueAnchors.push(18, 38, 352);
  if (tags.has("smoky")) hueAnchors.push(28, 220, 265);
  if (tags.has("herbal")) hueAnchors.push(118, 150, 172);
  if (tags.has("spicy")) hueAnchors.push(358, 16, 46);
  if (!hueAnchors.length || random() > 0.62) {
    hueAnchors.push(Math.round(random() * 360));
  }

  const baseHue = sampleWithRandom(hueAnchors, random);
  const hueSpread = 24 + random() * 150;
  const hues = [
    wrapHue(baseHue + randomRange(random, -hueSpread, hueSpread)),
    wrapHue(baseHue + randomRange(random, 42, 190)),
    wrapHue(baseHue + randomRange(random, -190, -36)),
    wrapHue(baseHue + randomRange(random, 140, 310))
  ];

  const saturationBase = 48 + random() * 38;
  const lightnessBase = 34 + random() * 22;
  const colors = hues.map((hue, index) => hslColor(
    hue,
    clamp(saturationBase + randomRange(random, -18, 24), 34, 92),
    clamp(lightnessBase + index * 8 + randomRange(random, -12, 18), 22, 78)
  ));

  if (random() > 0.45) colors.push(hslColor(wrapHue(baseHue + 180 + randomRange(random, -28, 28)), 65 + random() * 25, 72 + random() * 16));
  if (random() > 0.55) colors.push(hslColor(wrapHue(baseHue + randomRange(random, -12, 12)), 18 + random() * 24, 92 + random() * 6));
  return colors;
}

function randomizeServe(serve) {
  return {
    ...serve,
    shakeSeconds: sample([8, 10, 12]),
    stirSeconds: sample([18, 22, 25]),
    dilution: sample(["轻", "标准", "稍长"])
  };
}

function randomBaseAmount(strength, serve) {
  if (serve.long) return strength >= 4 ? sample(["45 ml", "50 ml"]) : sample(["30 ml", "40 ml", "45 ml"]);
  if (serve.id === "nightcap") return sample(["50 ml", "60 ml"]);
  return strength >= 4 ? sample(["50 ml", "60 ml"]) : sample(["40 ml", "45 ml", "50 ml"]);
}

function weightedPick(entries) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let cursor = Math.random() * total;
  for (const entry of entries) {
    cursor -= Math.max(0, entry.weight);
    if (cursor <= 0) return entry.item;
  }
  return entries[entries.length - 1]?.item;
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sampleWithRandom(items, random) {
  return items[Math.floor(random() * items.length)];
}

function randomRange(random, min, max) {
  return min + random() * (max - min);
}

function wrapHue(hue) {
  return Math.round(((hue % 360) + 360) % 360);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hslColor(hue, saturation, lightness) {
  return `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%)`;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seededRandom(seed) {
  let value = seed || 1;
  return () => {
    value = Math.imul(1664525, value) + 1013904223;
    return ((value >>> 0) / 4294967296);
  };
}

function chooseRecipeGarnish({ garnish, tags, ingredients, template, serve }) {
  const ingredientText = ingredients.map((item) => item.name).join(" ").toLowerCase();
  const options = [];
  const add = (...items) => options.push(...items);

  if (garnish?.name) add(garnish.name);
  if (template?.name?.includes("Margarita") || ingredientText.includes("龙舌兰") || ingredientText.includes("tequila")) {
    add("青柠角", "半圈盐边 + 青柠片", "青柠皮，轻轻挤油");
  }
  if (template?.name?.includes("Martini")) {
    add("橄榄", "柠檬 twist", "鸡尾酒洋葱");
  }
  if (template?.name?.includes("Old Fashioned") || ingredientText.includes("威士忌") || ingredientText.includes("whiskey")) {
    add("橙皮 twist", "橙皮 + 酒浸樱桃", "一颗酒浸樱桃");
  }
  if (template?.name?.includes("Mojito") || ingredientText.includes("薄荷")) {
    add("薄荷枝 + 青柠角", "拍醒的薄荷叶", "青柠轮片");
  }
  if (ingredientText.includes("咖啡") || ingredientText.includes("coffee") || ingredientText.includes("espresso")) {
    add("三颗咖啡豆", "橙皮 twist", "可可粉轻撒");
  }
  if (ingredientText.includes("椰")) {
    add("烤椰片", "菠萝叶", "青柠轮片");
  }
  if (tags.has("herbal") || tags.has("floral")) add("迷迭香枝", "薄荷尖", "可食用花瓣", "柠檬皮 twist");
  if (tags.has("fruity") || tags.has("sweet")) add("橙轮片", "脱水柑橘片", "水果薄片", "酒浸樱桃");
  if (tags.has("bitter")) add("橙皮 twist", "葡萄柚皮 twist", "脱水橙片");
  if (tags.has("smoky")) add("火烤橙皮", "迷迭香烟熏枝", "橙皮，轻轻挤油");
  if (tags.has("bright") || tags.has("sour")) add("柠檬轮片", "青柠角", "柑橘皮 twist");
  if (serve.long) add("长青柠皮", "黄瓜薄片", "薄荷尖", "柑橘轮片");
  if (serve.stirred) add("柠檬 twist", "橙皮 twist", "酒浸樱桃");

  if (!options.length) add("柠檬 twist", "橙皮 twist", "任意柑橘片");
  return sample([...new Set(options)]);
}

function renderRecipe(recipe) {
  ensureRecipeNames(recipe);
  const tagText = recipe.tags.map((tag) => flavorName[tag]).filter(Boolean).join(" / ");
  const art = recipe.art || buildRecipeArt(recipe.name, new Set(recipe.tags), { id: "highball", long: true });
  const nameEditorOpen = Boolean(recipe.nameEditorOpen);
  elements.recipePanel.innerHTML = `
    <div class="recipe-hero">
      <div class="recipe-header-row">
        <div class="recipe-heading">
          <p class="eyebrow">Tonight's Pour</p>
          <div class="recipe-name-row">
            <button class="recipe-title-button" id="toggleNameButton" type="button" title="切换经典名 / 抽象名">
              <span class="recipe-title">${escapeHtml(recipe.name)}</span>
            </button>
            <button class="name-edit-button" id="editNameButton" type="button" title="修改酒名" aria-label="修改酒名">✎</button>
          </div>
        </div>
        <div class="visual-token" aria-hidden="true">${art}</div>
      </div>
      <div>
        <div class="name-edit-panel${nameEditorOpen ? " active" : ""}" id="nameEditPanel">
          <label class="name-edit-label" for="recipeNameInput">自定义酒名</label>
          <div class="name-edit-controls">
            <input class="recipe-name-input" id="recipeNameInput" type="text" value="${escapeHtml(recipe.customName || recipe.name || "")}" placeholder="输入后会作为收藏名">
            <button class="secondary-button name-submit-button" id="submitNameButton" type="button" aria-label="保存酒名">√</button>
            <button class="ghost-button name-cancel-button" id="cancelNameButton" type="button" aria-label="取消编辑">×</button>
          </div>
        </div>
        <p class="recipe-intro">${escapeHtml(recipe.moodLine)}</p>
      </div>
    </div>

    <div class="recipe-meta">
      <div class="meta-item"><span>杯具</span>${escapeHtml(recipe.glass)}</div>
      <div class="meta-item"><span>装饰</span>${escapeHtml(recipe.garnish)}</div>
      <div class="meta-item"><span>风味</span>${escapeHtml(tagText || "即兴")}</div>
      <div class="meta-item"><span>库存</span>${state.bottles.length} 个材料</div>
    </div>

    <h3>材料</h3>
    <ul class="ingredient-list">
      ${recipe.ingredients.map((item) => `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.amount)}</strong></li>`).join("")}
    </ul>

    <h3>做法</h3>
    <ol class="step-list">
      ${recipe.steps.map((step, index) => `<li><span class="step-index">${index + 1}</span><span>${escapeHtml(step)}</span></li>`).join("")}
    </ol>

    <div class="recipe-actions">
      <button class="primary-button" id="saveRecipeButton" type="button"><span aria-hidden="true">☆</span>收藏配方</button>
      <button class="secondary-button" id="copyRecipeButton" type="button">复制</button>
    </div>
  `;

  document.querySelector("#saveRecipeButton").addEventListener("click", saveCurrentRecipe);
  document.querySelector("#copyRecipeButton").addEventListener("click", copyCurrentRecipe);
  document.querySelector("#toggleNameButton").addEventListener("click", toggleRecipeNameMode);
  document.querySelector("#editNameButton").addEventListener("click", toggleRecipeNameEditor);
  document.querySelector("#submitNameButton").addEventListener("click", saveRecipeCustomName);
  document.querySelector("#cancelNameButton").addEventListener("click", cancelRecipeNameEditor);
  document.querySelector("#recipeNameInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveRecipeCustomName();
    if (event.key === "Escape") cancelRecipeNameEditor();
  });
}

function ensureRecipeNames(recipe) {
  recipe.classicName = recipe.classicName || recipe.name;
  recipe.nameMode = recipe.nameMode || "classic";
  recipe.customName = recipe.customName || "";
  recipe.nameEditorOpen = Boolean(recipe.nameEditorOpen);
  if (!recipe.abstractName) {
    recipe.abstractName = buildAbstractRecipeName({
      prompt: "",
      ingredients: recipe.ingredients || [],
      serve: serveFromRecipe(recipe),
      tags: new Set(recipe.tags || [])
    });
  }
  if (recipe.customName) {
    recipe.name = recipe.customName;
  } else {
    recipe.name = recipe.nameMode === "abstract" ? recipe.abstractName : recipe.classicName;
  }
}

function toggleRecipeNameMode() {
  if (!currentRecipe) return;
  const nextMode = currentRecipe.nameMode === "abstract" ? "classic" : "abstract";
  currentRecipe.nameMode = nextMode;
  currentRecipe.customName = "";
  currentRecipe.name = nextMode === "abstract"
    ? (currentRecipe.abstractName || currentRecipe.name)
    : (currentRecipe.classicName || currentRecipe.name);
  currentRecipe.art = buildRecipeArt(currentRecipe.name, new Set(currentRecipe.tags), serveFromRecipe(currentRecipe));
  saveRecipeIfSaved(currentRecipe);
  renderRecipe(currentRecipe);
}

function toggleRecipeNameEditor() {
  if (!currentRecipe) return;
  currentRecipe.nameEditorOpen = !currentRecipe.nameEditorOpen;
  renderRecipe(currentRecipe);
  if (currentRecipe.nameEditorOpen) {
    const input = document.querySelector("#recipeNameInput");
    input?.focus();
    input?.select();
  }
}

function saveRecipeCustomName() {
  if (!currentRecipe) return;
  const input = document.querySelector("#recipeNameInput");
  const value = input?.value.trim() || "";
  currentRecipe.customName = value;
  currentRecipe.name = value || (currentRecipe.nameMode === "abstract"
    ? (currentRecipe.abstractName || currentRecipe.classicName || currentRecipe.name)
    : (currentRecipe.classicName || currentRecipe.abstractName || currentRecipe.name));
  currentRecipe.art = buildRecipeArt(currentRecipe.name, new Set(currentRecipe.tags), serveFromRecipe(currentRecipe));
  currentRecipe.nameEditorOpen = false;
  saveRecipeIfSaved(currentRecipe);
  renderRecipe(currentRecipe);
}

function cancelRecipeNameEditor() {
  if (!currentRecipe) return;
  currentRecipe.nameEditorOpen = false;
  renderRecipe(currentRecipe);
}

function serveFromRecipe(recipe) {
  const template = recipe.templateName || "";
  return {
    id: template.includes("Sour") || template.includes("酸") ? "sour" : template.includes("Spritz") ? "spritz" : "highball",
    long: template.includes("高球") || template.includes("Collins") || template.includes("Spritz"),
    stirred: template.includes("Martini") || template.includes("Old Fashioned") || template.includes("Negroni")
  };
}

function saveRecipeIfSaved(recipe) {
  const index = state.savedRecipes.findIndex((item) => item.id === recipe.id);
  if (index < 0) return;
  state.savedRecipes[index] = recipe;
  saveState();
  renderSaved();
}

function saveCurrentRecipe() {
  if (!currentRecipe) return;
  const duplicate = state.savedRecipes.find((recipe) => recipeFingerprint(recipe) === recipeFingerprint(currentRecipe));
  if (duplicate) {
    showSaveStatus("已在收藏");
    return;
  }
  const savedRecipe = { ...currentRecipe, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  currentRecipe = savedRecipe;
  state.savedRecipes.unshift(savedRecipe);
  state.savedRecipes = state.savedRecipes.slice(0, 24);
  saveState();
  renderSaved();
  switchView("savedView");
}

function showSaveStatus(message) {
  const button = document.querySelector("#saveRecipeButton");
  if (!button) return;
  const original = button.textContent;
  button.textContent = message;
  window.setTimeout(() => {
    button.innerHTML = `<span aria-hidden="true">☆</span>收藏配方`;
  }, 1200);
}

function recipeFingerprint(recipe) {
  return JSON.stringify({
    glass: recipe.glass,
    garnish: recipe.garnish,
    ingredients: (recipe.ingredients || []).map((item) => [item.name, item.amount]),
    steps: recipe.steps || []
  });
}

async function copyCurrentRecipe() {
  if (!currentRecipe) return;
  const text = [
    currentRecipe.name,
    currentRecipe.moodLine,
    "",
    "材料：",
    ...currentRecipe.ingredients.map((item) => `${item.name} ${item.amount}`),
    "",
    "做法：",
    ...currentRecipe.steps.map((step, index) => `${index + 1}. ${step}`)
  ].join("\n");

  await navigator.clipboard.writeText(text);
}

function renderSaved() {
  if (!state.savedRecipes.length) {
    elements.savedList.innerHTML = emptyList("还没有收藏", "生成一杯喜欢的配方后，把它留在这里。");
    return;
  }

  elements.savedList.innerHTML = state.savedRecipes.map((recipe) => `
    <article class="saved-card">
      <h3>${escapeHtml(recipe.name)}</h3>
      <p>${escapeHtml(recipe.moodLine)}</p>
      <div class="mini-tags">${recipe.tags.map((tag) => `<span>${flavorName[tag]}</span>`).join("")}</div>
      ${recipe.expanded ? renderSavedRecipeDetail(recipe) : ""}
      <div class="recipe-actions saved-actions">
        <button class="ghost-button" data-action="restore" data-id="${recipe.id}" type="button">${recipe.expanded ? "收起" : "查看"}</button>
        <button class="danger-button" data-action="remove" data-id="${recipe.id}" type="button">删除</button>
      </div>
    </article>
  `).join("");

  elements.savedList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const { action, id } = button.dataset;
      if (action === "restore") {
        state.savedRecipes = state.savedRecipes.map((recipe) => (
          recipe.id === id ? { ...recipe, expanded: !recipe.expanded } : recipe
        ));
        saveState();
        renderSaved();
      }
      if (action === "remove") {
        state.savedRecipes = state.savedRecipes.filter((recipe) => recipe.id !== id);
        saveState();
        renderSaved();
      }
    });
  });
}

function renderSavedRecipeDetail(recipe) {
  return `
    <div class="saved-detail">
      <div class="saved-meta">
        <span>${escapeHtml(recipe.glass)}</span>
        <span>${escapeHtml(recipe.garnish)}</span>
      </div>
      <h4>材料</h4>
      <ul class="ingredient-list saved-ingredient-list">
        ${(recipe.ingredients || []).map((item) => `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.amount)}</strong></li>`).join("")}
      </ul>
      <h4>做法</h4>
      <ol class="step-list saved-step-list">
        ${(recipe.steps || []).map((step, index) => `<li><span class="step-index">${index + 1}</span><span>${escapeHtml(step)}</span></li>`).join("")}
      </ol>
    </div>
  `;
}

function emptyList(title, detail) {
  return `
    <div class="saved-card">
      <h3>${title}</h3>
      <p>${detail}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}
