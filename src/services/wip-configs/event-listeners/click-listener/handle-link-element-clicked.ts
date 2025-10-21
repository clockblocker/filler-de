export const handleLinkElementClicked = ({
  linkElement,
}: {
  linkElement: HTMLElement;
}) => {
  const blockHtmlElement = linkElement.parentElement?.parentElement;

  const children = blockHtmlElement?.children;
  if (children) {
    const blockIdElement = Array.from(children).find((c) =>
      c.classList.contains("cm-blockid"),
    );

    if (blockIdElement) {
      const textContent = blockIdElement.textContent;
    }
  }
};
