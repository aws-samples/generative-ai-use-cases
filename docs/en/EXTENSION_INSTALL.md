# Browser Extension Installation Instructions

Browser extensions become available after installing them in your browser. Here, we explain the installation procedure for browsers.

## Installation Target

- If you built it yourself
  - All contents under the `browser-extension/dist/` folder, which is the build output, are the installation target.
- If you are using a distributed zip file or other compressed file
  - Extract the compressed file and save it to any location.
  - All contents under the extracted folder are the installation target.

## Installation Method

### For Google Chrome

Open the browser menu in the upper right corner and open the "Manage Extensions" screen.
![Chrome menu](../assets/images/extension/chrome_menu.png)
![Chrome extensions menu](../assets/images/extension/chrome_extension_menu.png)

After opening the "Extensions" management screen, turn the "Developer mode" to `ON`.
![Chrome developer mode](../assets/images/extension/chrome_dev_mode.png)

When "Developer mode" is turned `ON`, a button labeled "Load unpacked extension" will appear, so click on it.
![Chrome installation](../assets/images/extension/chrome_install.png)

A folder selection window will appear, so select the "Installation target" folder indicated in this procedure document.
![File selection](../assets/images/extension/file_choose.png)

Once installed, it will appear in the extensions list.
![Chrome installation complete](../assets/images/extension/chrome_installed.png)

### For Microsoft Edge

Open the menu with the extensions button at the top of the screen and open the "Manage extensions" screen.
![Edge menu](../assets/images/extension/edge_menu.png)

After opening the "Extensions" management screen, turn the "Developer mode" to `ON`.
![Edge developer mode](../assets/images/extension/edge_dev_mode.png)

When "Developer mode" is turned `ON`, a button labeled "Load unpacked" will appear, so click on it.
![Edge installation](../assets/images/extension/edge_install.png)

A folder selection window will appear, so select the "Installation target" folder indicated in this procedure document.
![File selection](../assets/images/extension/file_choose.png)

Once installed, it will appear in the extensions list.
![Edge installation complete](../assets/images/extension/edge_installed.png)

## How to Use

If the installation is successful, when you select text on any website, a popup displaying "GenU Extension" will appear as shown below. By clicking on this, the selected text will be automatically copied and the extension will launch.
![Popup display](../assets/images/extension/extension_popup.png)

Depending on the structure of the website, the popup may not appear. In that case, right-click to display the menu and click "GenU Extension" to launch it. This operation will also automatically copy the selected text.
![Context menu](../assets/images/extension/extension_context_menu.png)

If you right-click without selecting any text, a menu displaying "Open GenU Extension" will appear. In this case, the extension will open without copying any text.
![Context menu](../assets/images/extension/extension_context_menu_default.png)

The login screen will be displayed at the first launch. It uses the same authentication as the GenU Web app, so please log in using the same login information as that.
![Login screen](../assets/images/extension/extension_login.png)

## Uninstallation Method

### For Google Chrome

Open the "Extensions" management screen using the same procedure as the installation method. Click the "Remove" button for the extension you want to uninstall.

![Chrome uninstallation](../assets/images/extension/chrome_delete.png)

### For Microsoft Edge

Open the "Extensions" management screen using the same procedure as the installation method. Click the "Remove" button for the extension you want to uninstall.
![Edge uninstallation](../assets/images/extension/edge_delete.png)
