import { RulesConfig } from "./tabs_helpers";

function $$(id: string) {
  return document.querySelector(id);
}

document.addEventListener("DOMContentLoaded", function () {
  var duplicates = $$("input[name=duplicates]") as HTMLInputElement;
  var group = $$("input[name=group]") as HTMLInputElement;
  var group_domain = $$("#group_domain") as HTMLSelectElement;
  var host = $$("input[name=host]") as HTMLInputElement;

  const askForConfig = () => {
    chrome.runtime.sendMessage(
      "",
      "GET_CONFIG",
      function (config: RulesConfig) {
        console.log("display configuration", config);

        duplicates.checked = config.duplicates.isActivated;
        group.checked = config.group.isActivated;
        group_domain.options[
          config.group.type === "FULL_DOMAIN" ? 0 : 1
        ].selected = true;
        host.checked = config.host.isActivated;
      },
    );
  };

  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message == "NEW_CONFIG") {
      console.log("new configuration to display");
      askForConfig();
    }
  });

  askForConfig();

  const onUIChanged = () => {
    const conf: RulesConfig = {
      duplicates: {
        isActivated: duplicates.checked,
      },
      group: {
        isActivated: group.checked,
        type:
          group_domain.selectedOptions[0].value === "full_domain"
            ? "FULL_DOMAIN"
            : "SUB_DOMAIN",
      },
      host: {
        isActivated: host.checked,
        maxTabsAllowed: 5,
      },
    };
    chrome.runtime.sendMessage("", conf);
  };

  group_domain.addEventListener("input", onUIChanged);
  document
    .querySelectorAll("input")
    .forEach((s) => s.addEventListener("change", onUIChanged));
});
