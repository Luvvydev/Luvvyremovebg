# Third party notices

## BRIA RMBG 2.0 Web

Smart and general modes use the `kn4666/bria-rmbg-2.0-web` ONNX conversion of BRIA AI RMBG 2.0. The model is loaded from Hugging Face and runs locally in the browser through Transformers.js.

License: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).

This model is for personal and other non-commercial use only unless a separate commercial license is obtained from BRIA AI.

Original model: `briaai/RMBG-2.0`

Web ONNX conversion: `kn4666/bria-rmbg-2.0-web`

## IS-Net Anime

Smart and anime modes can use `BritishWerewolf/IS-Net-Anime`, a browser compatible ONNX background-removal model intended for anime and illustrated imagery.

License: Apache License 2.0.

Model: https://huggingface.co/BritishWerewolf/IS-Net-Anime

## ToonOut research reference

ToonOut was evaluated as the first anime-specific option because it is fine tuned for anime background removal. Its published model repository currently contains PyTorch weights rather than a Transformers.js compatible ONNX layout, so it is not loaded by the deployed GitHub Pages application.

License: MIT.

Model: https://huggingface.co/joelseytre/toonout

## @huggingface/transformers

Smart mode uses `@huggingface/transformers` version 4.3.0 to run supported ONNX models locally in the browser.

License: Apache License 2.0.

Source: https://github.com/huggingface/transformers.js

## @imgly/background-removal

Fast fallback mode uses `@imgly/background-removal` version 1.7.0 for browser based image segmentation and matting.

Copyright IMG.LY GmbH and contributors.

License: GNU Affero General Public License version 3.

Source: https://github.com/imgly/background-removal-js

The package runs background removal locally in the user's browser and downloads its model/runtime assets as described by the upstream project.
