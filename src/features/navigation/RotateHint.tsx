// The invitation to drag the cube, just under it, until the first drag of the
// session. `cube-hint` is a hook for the intro choreography (src/app/intro.css).
export function RotateHint({ visible, label }: { visible: boolean; label: string }) {
  return (
    <p
      className="cube-hint pointer-events-none absolute top-[68.5%] left-1/2 z-1 m-0 inline-flex -translate-x-1/2 items-center gap-[0.6rem] text-hint whitespace-nowrap text-page-ink/74 uppercase transition-opacity duration-600 ease-obsidian data-[visible=false]:opacity-0 motion-reduce:duration-1 stacked:top-[85%]"
      data-visible={visible}
    >
      <svg
        className="size-[1.15rem] text-violet-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.5 13.5a8 4.5 0 0 0 15 0" />
        <path d="M16.6 16.4l2.9-2.9 0.6 4" />
      </svg>
      <span>{label}</span>
    </p>
  )
}
