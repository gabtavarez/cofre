"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

const KEY = "mymony-privacy";
const TEST = /[−+-]?R\$\s?[\d.,]+/;
const REPLACE = /[−+-]?R\$\s?[\d.,]+/g;
const MASK = "R$ ••••";

const originals = new WeakMap<Text, string>();
const masked = new WeakMap<Text, string>();

function eachText(root: Node, fn: (n: Text) => void) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    const p = n.parentElement;
    if (p && ["SCRIPT", "STYLE", "TEXTAREA"].includes(p.tagName)) continue;
    fn(n as Text);
  }
}

function mask(n: Text) {
  const v = n.nodeValue ?? "";
  const m = masked.get(n);
  if (m !== undefined && v === m) return;
  if (TEST.test(v)) {
    originals.set(n, v);
    const next = v.replace(REPLACE, MASK);
    masked.set(n, next);
    n.nodeValue = next;
  } else if (m !== undefined) {
    originals.delete(n);
    masked.delete(n);
  }
}

function restore(n: Text) {
  const o = originals.get(n);
  if (o !== undefined && n.nodeValue === masked.get(n)) n.nodeValue = o;
  originals.delete(n);
  masked.delete(n);
}

/** Esconde todos os valores em R$ da tela (e guarda a escolha neste navegador). */
export function PrivacyToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {}
    if (!on) {
      eachText(document.body, restore);
      return;
    }
    eachText(document.body, mask);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") mask(m.target as Text);
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) mask(node as Text);
          else eachText(node, mask);
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [on]);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      aria-label={on ? "Mostrar valores" : "Esconder valores"}
      title={on ? "Mostrar valores" : "Esconder valores"}
      className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-text"
    >
      <Icon name={on ? "eyeoff" : "eye"} />
    </button>
  );
}
