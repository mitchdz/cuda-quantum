/*******************************************************************************
 * Copyright (c) 2022 - 2026 NVIDIA Corporation & Affiliates.                  *
 * All rights reserved.                                                        *
 *                                                                             *
 * This source code and the accompanying materials are made available under    *
 * the terms of the Apache License 2.0 which accompanies this distribution.    *
 ******************************************************************************/
/*******************************************************************************
 * File: copy_as_markdown.js                                                   *
 *                                                                             *
 * Adds a "Copy as Markdown" button to each documentation page. The button     *
 * copies the sibling Markdown file (generated alongside every HTML page by     *
 * scripts/build_docs.sh) to the clipboard, making the docs easy to reuse in    *
 * notes, technical documents, and AI coding assistants.                        *
 ******************************************************************************/

document.addEventListener('DOMContentLoaded', function () {
    const DEFAULT_LABEL = 'Copy as Markdown';
    const RESET_DELAY_MS = 2000;

    // Compute the URL of the sibling Markdown file for the current page.
    function markdownUrl() {
        const path = window.location.pathname;
        if (path.endsWith('.html')) {
            return path.slice(0, -'.html'.length) + '.md';
        }
        if (path.endsWith('/')) {
            return path + 'index.md';
        }
        // Extensionless (clean) URL: assume the page is served as <path>.md.
        return path + '.md';
    }

    // Find the breadcrumbs "aside" cell, creating it if the theme left it out
    // (it is empty by default because html_show_sourcelink is disabled).
    function injectionPoint() {
        let aside = document.querySelector('.wy-breadcrumbs-aside');
        if (aside) {
            return aside;
        }
        const crumbs = document.querySelector('.wy-breadcrumbs');
        if (crumbs) {
            aside = document.createElement('li');
            aside.className = 'wy-breadcrumbs-aside';
            crumbs.appendChild(aside);
            return aside;
        }
        // No breadcrumbs on this page (e.g. some notebook layouts): do nothing.
        return null;
    }

    // Copy text to the clipboard, falling back to execCommand when the async
    // Clipboard API is unavailable (e.g. plain-HTTP intranet previews).
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText &&
            window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.top = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(textarea);
                ok ? resolve() : reject(new Error('execCommand copy failed'));
            } catch (err) {
                reject(err);
            }
        });
    }

    function makeButton(url) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'copy-as-markdown-btn';
        button.textContent = DEFAULT_LABEL;
        button.setAttribute('aria-label', 'Copy this page as Markdown');

        let resetTimer = null;
        function flash(label, stateClass) {
            button.textContent = label;
            button.classList.remove('copy-success', 'copy-error');
            if (stateClass) {
                button.classList.add(stateClass);
            }
            if (resetTimer) {
                clearTimeout(resetTimer);
            }
            resetTimer = setTimeout(function () {
                button.textContent = DEFAULT_LABEL;
                button.classList.remove('copy-success', 'copy-error');
            }, RESET_DELAY_MS);
        }

        button.addEventListener('click', function () {
            fetch(url)
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.text();
                })
                .then(function (text) {
                    return copyText(text);
                })
                .then(function () {
                    flash('Copied!', 'copy-success');
                })
                .catch(function () {
                    flash('Copy failed', 'copy-error');
                });
        });
        return button;
    }

    const point = injectionPoint();
    if (!point) {
        return;
    }
    const url = markdownUrl();
    // Only show the button when the sibling Markdown is actually reachable, so
    // plain sphinx-build outputs (no pandoc step) and file:// previews do not
    // render a broken button.
    fetch(url, { method: 'HEAD' })
        .then(function (response) {
            if (response.ok) {
                point.appendChild(makeButton(url));
            }
        })
        .catch(function () {
            /* Markdown not available (or file:// context): no button. */
        });
});
