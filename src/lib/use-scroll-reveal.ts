import { useEffect, type RefObject } from 'react'

const targets = '[data-reveal], [data-reveal-group] > *'

// SSR HTML은 기본적으로 보이게 두고, 브라우저가 지원할 때만 스크롤 등장 효과를 적용합니다.
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
        // 부모와 자식에 효과를 겹치지 않고 가장 바깥 블록에만 한 번 적용합니다.
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

    // 키보드로 이동한 요소는 애니메이션 대기 상태와 무관하게 즉시 표시합니다.
    function showFocused(event: FocusEvent) {
      if (!(event.target instanceof Node)) return
      for (const element of elements) {
        if (element.contains(event.target)) reveal(element, true)
      }
    }
    function onMotionChange() {
      if (reducedMotion.matches) elements.forEach((element) => reveal(element, true))
    }

    // 지연 로딩·관리자 저장으로 레이아웃 재마운트 없이 추가된 카드도 관찰 대상에 포함합니다.
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
