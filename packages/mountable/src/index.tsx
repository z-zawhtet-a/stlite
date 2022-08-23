import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { StliteKernel } from "@stlite/stlite-kernel";
import { getParentUrl } from "./url";
import { canonicalizeMountOptions, MountOptions } from "./options";

/**
 * If `PUBLIC_PATH` which is exported as a global variable `__webpack_public_path__` (https://webpack.js.org/guides/public-path/#on-the-fly)
 * is set as a relative URL, resolve and override it based on the URL of this script itself,
 * which will be transpiled into `stlite.js` at the root of the output directory.
 */
let wheelBaseUrl: string | undefined = undefined;
if (
  typeof __webpack_public_path__ === "string" &&
  (__webpack_public_path__ === "." || __webpack_public_path__.startsWith("./"))
) {
  if (document.currentScript && "src" in document.currentScript) {
    const selfScriptUrl = document.currentScript.src;
    const selfScriptBaseUrl = getParentUrl(selfScriptUrl);

    __webpack_public_path__ = selfScriptBaseUrl; // For webpack dynamic imports
    wheelBaseUrl = selfScriptBaseUrl;
  }
}

export function mount(
  options: MountOptions,
  container: HTMLElement = document.body
) {
  const kernel = new StliteKernel({
    ...canonicalizeMountOptions(options),
    wheelBaseUrl,
  });

  ReactDOM.render(
    <React.StrictMode>
      <App kernel={kernel} />
    </React.StrictMode>,
    container
  );

  return {
    unmount: () => {
      kernel.dispose();
      ReactDOM.unmountComponentAtNode(container);
    },
    install: (requirements: string[]) => {
      return kernel.install(requirements);
    },
    writeFile: (
      path: string,
      data: string | ArrayBufferView,
      opts?: Record<string, any>
    ) => {
      return kernel.writeFile(path, data, opts);
    },
  };
}

if (process.env.NODE_ENV === "development") {
  mount(
    //     `import streamlit as st

    // st.write("Hello world")
    //     `,
    {
      entrypoint: "streamlit_app.py",
      files: {
        "streamlit_app.py": `import streamlit as st
import matplotlib.pyplot as plt
import numpy as np

size = st.slider("Sample size", 100, 1000)

arr = np.random.normal(1, 1, size=size)
fig, ax = plt.subplots()
ax.hist(arr, bins=20)

st.pyplot(fig)
    `,
      },
      requirements: ["matplotlib"],
    },
    document.getElementById("root") as HTMLElement
  );
}