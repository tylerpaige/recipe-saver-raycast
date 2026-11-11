import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  getPreferenceValues,
  popToRoot,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { useEffect, useState } from "react";

interface FormValues {
  url: string;
  tags: string;
  autoTag: boolean;
  note: string;
}

function binaryPath(): string {
  const { binaryPath } = getPreferenceValues<{ binaryPath?: string }>();
  return (binaryPath || "~/bin/recipe-saver").replace(/^~(?=$|\/)/, homedir());
}

function isUrl(text: string): boolean {
  return /^https?:\/\/\S+$/.test(text.trim());
}

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binaryPath(), args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve(stdout.trim());
    });
  });
}

export default function Command() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string>();

  // Start with the URL on the clipboard, if there is one
  useEffect(() => {
    Clipboard.readText().then((text) => {
      if (text && isUrl(text)) setUrl((current) => current || text.trim());
    });
  }, []);

  async function handleSubmit(values: FormValues) {
    if (!isUrl(values.url)) {
      setUrlError("Enter an http(s) URL");
      return;
    }

    const args = ["add", values.url.trim()];
    if (values.tags.trim()) args.push("--tag", values.tags.trim());
    if (!values.autoTag) args.push("--auto-tag=false");
    if (values.note.trim()) args.push("-m", values.note.trim());

    const toast = await showToast({ style: Toast.Style.Animated, title: "Queueing recipe…" });
    try {
      await run(args);
      await showHUD("Recipe queued");
      await popToRoot();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Couldn't queue recipe";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Recipe" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="URL"
        placeholder="https://…"
        value={url}
        error={urlError}
        onChange={(value) => {
          setUrl(value);
          if (urlError) setUrlError(undefined);
        }}
      />
      <Form.TextField id="tags" title="Tags" placeholder="dinner, comfort food" />
      <Form.Checkbox id="autoTag" label="Let Claude add tags too" defaultValue={true} />
      <Form.TextArea id="note" title="Note" placeholder="Sam's favourite" />
    </Form>
  );
}
