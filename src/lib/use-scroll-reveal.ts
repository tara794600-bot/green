import { useEffect, type RefObject } from 'react'

const targets = '[data-reveal], [data-reveal-group] > *'

export function useScrollReveal(ref: RefObject<HTMLElement | null>, pathname: string) {
  useEffect(() => {
    const root = ref.current
    if (!root || !('IntersectionObserver' in window) || !Element.prototype.animate) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const elements = new Set<HTMLElement>()
    const animations = new Map<HTMLElement, Animation>()
    let frame = 0

    function reveal(element: HTMLElement, immediate = false) {
      observer.unobserve(element)
      const pending = element.dataset.revealState === 'pending'
      element.dataset.revealState = 'visible'
      if (immediate || reducedMotion.matches) {
        animations.get(element)?.cancel()
        animations.delete(element)
        return
      }
      if (!pending) return

      const direction = element.dataset.reveal
      const offset =
        window.innerWidth <= 600
          ? '0 18px'
          : direction === 'left'
            ? '-24px 0'
            : direction === 'right'
              ? '24px 0'
              : '0 24px'
      const group = element.parentElement
      const index = group?.hasAttribute('data-reveal-group') ? [...group.children].indexOf(element) : 0
      const delay = Number(element.dataset.revealDelay || Math.min(index, 3) * 80)
      const animation = element.animate(
        [
          {
            opacity: 0,
            translate: direction === 'zoom' ? '0 0' : offset,
            scale: direction === 'zoom' ? 0.97 : 1,
          },
          { opacity: 1, translate: '0 0', scale: 1 },
        ],
        { duration: 720, delay, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
      )
      animations.set(element, animation)
      animation.onfinish = () => animations.delete(element)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement)
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    )

    function register() {
      frame = 0
      for (const element of elements) {
        if (!root!.contains(element)) {
          observer.unobserve(element)
          animations.get(element)?.cancel()
          animations.delete(element)
          elements.delete(element)
          delete element.dataset.revealState
        }
      }
      for (const element of root!.querySelectorAll<HTMLElement>(targets)) {
        if (elements.has(element)) continue
        // Animate the outer block once instead of stacking reveals on its children.
        if (element.parentElement?.closest(targets)) continue
        elements.add(element)
        if (reducedMotion.matches || element.getBoundingClientRect().bottom <= 0) {
          element.dataset.revealState = 'visible'
        } else {
          element.dataset.revealState = 'pending'
          observer.observe(element)
        }
      }
    }

    function showFocused(event: FocusEvent) {
      if (!(event.target instanceof Node)) return
      for (const element of elements) {
        if (element.contains(event.target)) reveal(element, true)
      }
    }
    function onMotionChange() {
      if (reducedMotion.matches) elements.forEach((element) => reveal(element, true))
    }

    // Lazy routes and CMS updates can insert new cards without mounting the layout again.
    const mutations = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(register)
    })
    register()
    mutations.observe(root, { childList: true, subtree: true })
    root.addEventListener('focusin', showFocused)
    reducedMotion.addEventListener('change', onMotionChange)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      mutations.disconnect()
      root.removeEventListener('focusin', showFocused)
      reducedMotion.removeEventListener('change', onMotionChange)
      animations.forEach((animation) => animation.cancel())
      elements.forEach((element) => delete element.dataset.revealState)
    }
  }, [ref, pathname])
}
