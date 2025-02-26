import React, { useState, useEffect } from "react";
import { StliteKernel, StliteKernelOptions } from "@stlite/kernel";
import {
  AppData,
  extractAppDataFromUrl,
  ForwardMessage,
  ReplyMessage,
} from "@stlite/sharing-common";
import StreamlitApp from "./StreamlitApp";
import { toast } from "react-toastify";
import {
  makeToastKernelCallbacks,
  ErrorToastContent,
} from "@stlite/common-react";
import "@stlite/common-react/src/toastify-components/toastify.css";

const editorAppOriginRegex = process.env.REACT_APP_EDITOR_APP_ORIGIN_REGEX
  ? new RegExp(process.env.REACT_APP_EDITOR_APP_ORIGIN_REGEX)
  : undefined;
function isEditorOrigin(origin: string): boolean {
  if (editorAppOriginRegex) {
    return editorAppOriginRegex.test(origin);
  }

  return origin === process.env.REACT_APP_EDITOR_APP_ORIGIN;
}

function convertFiles(
  appDataFiles: AppData["files"]
): StliteKernelOptions["files"] {
  let files: StliteKernelOptions["files"] = {};
  Object.keys(appDataFiles).forEach((key) => {
    const value = appDataFiles[key];
    if (value.content == null) {
      return;
    }
    files[key] = {
      data:
        value.content.$case === "text"
          ? value.content.text
          : value.content.data,
    };
  });
  return files;
}

function App() {
  const [kernel, setKernel] = useState<StliteKernel>();
  useEffect(() => {
    let unmounted = false;
    let _kernel: StliteKernel | null = null;
    let onMessage: ((e: MessageEvent<ForwardMessage>) => void) | null;
    extractAppDataFromUrl()
      .catch(() => {
        const defaultAppData: AppData = {
          entrypoint: "streamlit_app.py",
          files: {
            "streamlit_app.py": {
              content: {
                $case: "text",
                text: `import streamlit as st
st.write("Hello World")`,
              },
            },
          },
          requirements: [],
        };
        return defaultAppData;
      })
      .then((appData) => {
        if (unmounted) {
          return;
        }

        console.debug("Initialize with", appData);

        const kernel = new StliteKernel({
          entrypoint: appData.entrypoint,
          files: convertFiles(appData.files),
          requirements: appData.requirements,
          ...makeToastKernelCallbacks(),
        });
        _kernel = kernel;
        setKernel(kernel);

        // Handle messages from the editor
        onMessage = (event) => {
          if (!isEditorOrigin(event.origin)) {
            return;
          }

          const port2 = event.ports[0];
          function postReplyMessage(msg: ReplyMessage) {
            port2.postMessage(msg);
          }

          const msg = event.data;
          (() => {
            switch (msg.type) {
              case "file:write": {
                return toast.promise(
                  kernel.writeFile(msg.data.path, msg.data.content),
                  {
                    error: "Failed to write the file",
                  },
                  {
                    hideProgressBar: true,
                    position: toast.POSITION.BOTTOM_RIGHT,
                  }
                );
              }
              case "file:rename": {
                return toast.promise(
                  kernel.renameFile(msg.data.oldPath, msg.data.newPath),
                  {
                    error: "Failed to rename the file",
                  },
                  {
                    hideProgressBar: true,
                    position: toast.POSITION.BOTTOM_RIGHT,
                  }
                );
              }
              case "file:unlink": {
                return toast.promise(
                  kernel.unlink(msg.data.path),
                  {
                    error: "Failed to remove the file",
                  },
                  {
                    hideProgressBar: true,
                    position: toast.POSITION.BOTTOM_RIGHT,
                  }
                );
              }
              case "install": {
                return toast.promise<void, Error>(
                  kernel.install(msg.data.requirements),
                  {
                    pending: "Installing",
                    success: "Successfully installed",
                    error: {
                      render({ data }) {
                        return (
                          <ErrorToastContent
                            message="Failed to install"
                            error={data}
                          />
                        );
                      },
                      autoClose: false,
                      closeOnClick: false,
                    },
                  },
                  {
                    hideProgressBar: true,
                    position: toast.POSITION.BOTTOM_RIGHT,
                  }
                );
              }
            }
          })()
            .then(() => {
              postReplyMessage({
                type: "reply",
              });
            })
            .catch((error) => {
              postReplyMessage({
                type: "reply",
                error,
              });
            });
        };
        window.addEventListener("message", onMessage);
      });

    return () => {
      unmounted = true;

      onMessage && window.removeEventListener("message", onMessage);
      _kernel && _kernel.dispose();
    };
  }, []);

  return kernel ? <StreamlitApp kernel={kernel} /> : null;
}

export default App;
