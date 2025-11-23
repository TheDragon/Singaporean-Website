import wixData from 'wix-data';
import { cart } from 'wix-stores-frontend';

const PACKAGE_PRODUCT_ID = "d2ce1f85-f363-45c0-b5bd-c37cc3cb707b"; // product ID from Stores, without "product_"

let selectedPackage = null;
let selectedItems = {
  basic: [],
  standard: [],
  premium: []
};

$w.onReady(async () => {
  await loadPackages();
  await loadItems();
  updateTotalPrice();
});

/* ------------------- PACKAGES ------------------- */
async function loadPackages() {
  const res = await wixData.query("Packages")
    .eq("isActive", true)
    .find();

  const packages = res.items;
  $w('#packageRepeater').data = packages;

  $w('#packageRepeater').onItemReady(($item, itemData) => {
    $item('#packageTitle').text = itemData.title || "";
    $item('#packageDesc').text = itemData.description || "";
    $item('#packageBasePrice').text =
      itemData.basePrice != null
        ? `Base Price: $${itemData.basePrice}`
        : "";

    $item('#selectPackageBtn').label =
      (selectedPackage && selectedPackage._id === itemData._id)
        ? "Selected"
        : "Select Package";

    $item('#selectPackageBtn').onClick(() => {
      selectedPackage = itemData;
      resetSelections();
      refreshPackageButtons(packages);
      updateTotalPrice();
      // clear summary display text when package changes
      $w('#selectionSummaryText').text = "";
    });
  });
}

function refreshPackageButtons(packages) {
  $w('#packageRepeater').forEachItem(($item, itemData) => {
    $item('#selectPackageBtn').label =
      (selectedPackage && selectedPackage._id === itemData._id)
        ? "Selected"
        : "Select Package";
  });
}

/* ------------------- ITEMS ------------------- */
async function loadItems() {
  const res = await wixData.query("Items")
    .eq("isActive", true)
    .include("category")
    .find();

  const items = res.items;

  const basicItems = items.filter(i => i.category && i.category.title === "Basic");
  const standardItems = items.filter(i => i.category && i.category.title === "Standard");
  const premiumItems = items.filter(i => i.category && i.category.title === "Premium");

  setupRepeater('basic', basicItems);
  setupRepeater('standard', standardItems);
  setupRepeater('premium', premiumItems);
}

function setupRepeater(categoryKey, items) {
  const repeaterId = `#${categoryKey}Repeater`;
  $w(repeaterId).data = items;

  $w(repeaterId).onItemReady(($item, itemData) => {
    $item(`#${categoryKey}ItemTitle`).text = itemData.title || "";
    $item(`#${categoryKey}ItemPrice`).text =
      itemData.topUpPrice
        ? `+ $${itemData.topUpPrice} (top-up)`
        : "Included";

    if (itemData.image) {
      $item(`#${categoryKey}ItemImage`).src = itemData.image;
      $item(`#${categoryKey}ItemImage`).alt = itemData.title || "";
    }

    const btnId = `#${categoryKey}AddBtn`;
    $item(btnId).label = isSelected(categoryKey, itemData) ? "Remove" : "Add";
    $item(btnId).onClick(() => {
      handleItemToggle(categoryKey, itemData);
      $item(btnId).label = isSelected(categoryKey, itemData) ? "Remove" : "Add";
      updateSummaryDisplay();   // Update summary display each click
    });
  });
}

/* ------------------- SELECTION LOGIC ------------------- */
function handleItemToggle(categoryKey, itemData) {
  if (!selectedPackage) {
    $w('#totalPriceText').text = "Please select a package first.";
    return;
  }

  const list = selectedItems[categoryKey];
  const already = list.find(i => i._id === itemData._id);
  const maxLimit = getMaxLimit(categoryKey);

  if (already) {
    selectedItems[categoryKey] = list.filter(i => i._id !== itemData._id);
    updateTotalPrice();
    return;
  }

  if (list.length >= maxLimit) {
    $w('#totalPriceText').text = `Limit reached: ${maxLimit} ${categoryKey} item(s).`;
    return;
  }

  list.push(itemData);
  updateTotalPrice();
}

function getMaxLimit(categoryKey) {
  if (!selectedPackage) return 0;
  if (categoryKey === "basic") return selectedPackage.maxBasic || 0;
  if (categoryKey === "standard") return selectedPackage.maxStandard || 0;
  if (categoryKey === "premium") return selectedPackage.maxPremium || 0;
  return 0;
}

function isSelected(categoryKey, itemData) {
  return selectedItems[categoryKey].some(i => i._id === itemData._id);
}

function resetSelections() {
  selectedItems = {
    basic: [],
    standard: [],
    premium: []
  };
  updateSummaryDisplay(); // Clear summary when package changes
}

/* ------------------- PRICE & SUMMARY ------------------- */
function updateTotalPrice() {
  if (!selectedPackage) {
    $w('#totalPriceText').text = "Select a package to begin.";
    return;
  }

  let total = selectedPackage.basePrice || 0;

  ["basic", "standard", "premium"].forEach(cat => {
    selectedItems[cat].forEach(item => {
      if (item.hasTopUp && item.topUpPrice) {
        total += item.topUpPrice;
      }
    });
  });

  $w('#totalPriceText').text = `Total: $${total}`;
  updateSummaryDisplay();
}

function updateSummaryDisplay() {
  if (!selectedPackage) {
    $w('#selectionSummaryText').text = "No package selected.";
    return;
  }

  const basicNames = selectedItems.basic.map(i => i.title);
  const standardNames = selectedItems.standard.map(i => i.title);
  const premiumNames = selectedItems.premium.map(i => i.title);

  const summaryLines = [];

  // show selected package
  summaryLines.push(`Package: ${selectedPackage.title}`);

  // then show selected items by category
  if (basicNames.length) summaryLines.push(`Basic: ${basicNames.join(", ")}`);
  if (standardNames.length) summaryLines.push(`Standard: ${standardNames.join(", ")}`);
  if (premiumNames.length) summaryLines.push(`Premium: ${premiumNames.join(", ")}`);

  const summaryText = summaryLines.join(" | ");
  $w('#selectionSummaryText').text = summaryText || "No items selected yet.";
}

/* ------------------- ADD TO CART ------------------- */
// This function name must be selected in the button's onClick in the Editor
export async function addToCartButton_click(event) {
  console.log("👉 addToCartButton_click fired", { selectedPackage, selectedItems });

  if (!selectedPackage) {
    $w('#totalPriceText').text = "Please select a package first.";
    return;
  }

  try {
    const result = await cart.addProducts([
      { productId: PACKAGE_PRODUCT_ID, quantity: 1 }
    ]);
    console.log("Cart result:", result);
  } catch (err) {
    console.error("Error adding to cart:", err);
    $w('#totalPriceText').text = "Unable to add to cart.";
  }
}
