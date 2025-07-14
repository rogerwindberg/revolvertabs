document.addEventListener('DOMContentLoaded', addEventListeners);

function addEventListeners() {
  restoreOptions();
  buildCurrentTabsList();
  document.querySelector('#save').addEventListener('click', saveAllOptions);
}

function saveBaseOptions(callback) {
  const appSettings = {
    seconds: document.getElementById("seconds").value,
    reload: document.getElementById("reload").checked,
    inactive: document.getElementById("inactive").checked,
    autostart: document.getElementById("autostart").checked,
    ignoreGroups: document.getElementById("ignoreGroups").checked,
    noRefreshList: document.getElementById('noRefreshList').value.split('\n')
  };

  chrome.storage.local.set({ "revolverSettings": appSettings }, () => {
    document.getElementById("status").textContent = "OPTIONS SAVED";
    setTimeout(() => { document.getElementById("status").textContent = ""; }, 1000);
    chrome.runtime.sendMessage({ action: "updateSettings" });
    callback();
  });
}

function restoreOptions() {
  chrome.storage.local.get("revolverSettings", (result) => {
    const appSettings = result.revolverSettings || {};
    document.getElementById("seconds").value = appSettings.seconds || 10;
    document.getElementById("reload").checked = appSettings.reload || false;
    document.getElementById("inactive").checked = appSettings.inactive || false;
    document.getElementById("autostart").checked = appSettings.autostart || false;
    document.getElementById("ignoreGroups").checked = appSettings.ignoreGroups || false;
    document.getElementById("noRefreshList").value = (appSettings.noRefreshList || []).join('\n');
  });
}

function saveAdvancedOptions(callback) {
  const advUrlObjectMap = new Map();
  const advancedDivs = document.getElementById("adv-settings-list").getElementsByTagName("div");

  for (let i = 0; i < advancedDivs.length; i++) {
    const urlInput = advancedDivs[i].getElementsByClassName("url-text")[0];
    const enableInput = advancedDivs[i].getElementsByClassName("enable")[0];
    const iconInput = advancedDivs[i].getElementsByClassName("icon")[0];
    const divInputTags = advancedDivs[i].getElementsByTagName("input");

    if (!urlInput || !enableInput || divInputTags.length < 4) {
      continue;
    }

    const url = urlInput.value.trim();
    if (!url) continue;

    const enabled = enableInput.checked;

    advUrlObjectMap.set(url, {
      "url": url,
      "enabled": enabled,
      "reload": divInputTags[3].checked,
      "seconds": divInputTags[2].value,
      "favIconUrl": iconInput ? iconInput.src : ""
    });
  }

  chrome.storage.local.set(
    { "revolverAdvSettings": Array.from(advUrlObjectMap.values()) },
    () => {
      chrome.runtime.sendMessage({ action: "updateSettings" });
      const status3 = document.getElementById("status3");
      if (status3) {
        status3.textContent = "OPTIONS SAVED";
        setTimeout(() => { status3.textContent = ""; }, 1000);
      }
      callback();
    }
  );
}

function saveAllOptions() {
  saveBaseOptions(() => {
    saveAdvancedOptions(() => {});
  });
}

function buildCurrentTabsList() {
  const advancedSettingsList = document.getElementById("adv-settings-list");
  advancedSettingsList.innerHTML = "";

  getCurrentTabs(allCurrentTabs => {
    chrome.storage.local.get("revolverAdvSettings", (result) => {
      const savedSettings = result.revolverAdvSettings || [];

      const savedUrls = savedSettings.map(s => s.url);
      const uniqueNewTabs = allCurrentTabs.filter(tab => !savedUrls.includes(tab.url));

      savedSettings.forEach(tab => generateAdvancedSettingsHtml(tab, true));

      uniqueNewTabs.forEach(tab => generateAdvancedSettingsHtml(tab, false));

      createAdvancedSaveButton();
    });
  });
}

function getCurrentTabs(callback) {
  chrome.storage.local.get("revolverSettings", (result) => {
    const ignoreGroups = result.revolverSettings?.ignoreGroups || false;

    chrome.windows.getCurrent({ populate: true }, function(window) {
      let tabs = window.tabs.filter(tab => !tab.url.startsWith("chrome-extension"));
      
      if (ignoreGroups) {
        tabs = tabs.filter(tab => tab.groupId === -1);
      }

      callback(tabs);
    });
  });
}

function generateAdvancedSettingsHtml(tab, saved) {
  const advancedSettingsList = document.getElementById("adv-settings-list");

  const div = document.createElement("div");
  div.className = "adv-settings-item";
  div.style.marginBottom = "10px";

  const customEnableDiv = document.createElement("div");
  customEnableDiv.className = "custom-checkbox";

  const enableInput = document.createElement("input");
  enableInput.type = "checkbox";
  enableInput.className = "enable";
  enableInput.name = "enable";
  enableInput.id = `enable-${tab.url}`;
  if (saved && tab.enabled) enableInput.checked = true;

  const enableLabel = document.createElement("label");
  enableLabel.setAttribute("for", enableInput.id);
  enableLabel.innerText = " Custom";

  customEnableDiv.appendChild(enableInput);
  customEnableDiv.appendChild(enableLabel);

  const icon = document.createElement("img");
  icon.className = "icon";
  icon.src = tab.favIconUrl || "";

  const urlInput = document.createElement("input");
  urlInput.className = "url-text";
  urlInput.type = "text";
  urlInput.value = tab.url;
  urlInput.disabled = !enableInput.checked;

  const secondsP = document.createElement("p");
  secondsP.style.display = "inline-flex";
  secondsP.style.height = "25px";

  const secondsLabel = document.createElement("label");
  secondsLabel.innerText = "Seconds:";
  secondsLabel.style.marginLeft = "30px";
  secondsLabel.style.marginRight = "5px";

  const secondsInput = document.createElement("input");
  secondsInput.type = "text";
  secondsInput.name = "seconds";
  secondsInput.style.width = "30px";
  secondsInput.value = saved && tab.seconds ? tab.seconds : "10";
  secondsInput.disabled = !enableInput.checked;

  const customReloadDiv = document.createElement("div");
  customReloadDiv.className = "custom-checkbox";

  const reloadInput = document.createElement("input");
  reloadInput.type = "checkbox";
  reloadInput.name = "reload";
  reloadInput.id = `reload-${tab.url}`;
  if (saved && tab.reload) reloadInput.checked = true;
  reloadInput.disabled = !enableInput.checked;

  const reloadLabel = document.createElement("label");
  reloadLabel.setAttribute("for", reloadInput.id);
  reloadLabel.innerText = "Reload";

  customReloadDiv.appendChild(reloadInput);
  customReloadDiv.appendChild(reloadLabel);

  secondsP.appendChild(secondsLabel);
  secondsP.appendChild(secondsInput);
  secondsP.appendChild(customReloadDiv);
  
  enableInput.addEventListener('change', () => {
    const enabled = enableInput.checked;
    urlInput.disabled = !enabled;
    secondsInput.disabled = !enabled;
    reloadInput.disabled = !enabled;
  });

  div.appendChild(customEnableDiv);
  div.appendChild(icon);
  div.appendChild(urlInput);
  div.appendChild(secondsP);

  advancedSettingsList.appendChild(div);
}

function createAdvancedSaveButton() {
  if (document.getElementById("adv-save")) return;

  const parent = document.getElementById("adv-settings");

  const advSaveButton = document.createElement("button");
  advSaveButton.setAttribute("id", "adv-save");
  advSaveButton.innerText = "Save";
  advSaveButton.addEventListener("click", saveAllOptions);

  const advSaveIndicator = document.createElement("span");
  advSaveIndicator.setAttribute("id", "status3");

  parent.appendChild(advSaveButton);
  parent.appendChild(advSaveIndicator);
}