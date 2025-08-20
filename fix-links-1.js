/**
 * fix-links.js
 * 全局修复“无法抓取的链接”：为 UI 按钮型 <a> 提供可抓取/无害 href，
 * 同时保留原交互；补充 rel / target 安全属性；兼容你主题里常见的 class。
 */

(function () {
  const INVALID_HREFS = new Set(['', '#', 'javascript:void(0)', 'javascript:void(0);', 'void(0)']);

  // 这些 class 多为“按钮型 a 标签”，给它们补齐 href 与无跳转行为
  const BUTTONY_CLASSES = new Set([
    'darkmode_switchbutton',  // 夜间模式
    'asideSwitch',            // 侧栏开关
    'commentBarrage',         // 评论弹幕
    'console_switchbutton',   // 控制台开关
    'banner-button',          // 更多推荐/弹层按钮
    'totopbtn',               // 返回顶部
    'randomPost_button',      // 随机文章
    'randomPost',             // 一些主题用这个
    'site-page'               // 站内页签（菜单页签型）
  ]);

  // 安全补齐：target=_blank 则添加 rel
  function hardenRel(a) {
    const t = (a.getAttribute('target') || '').toLowerCase();
    if (t === '_blank') {
      const rel = (a.getAttribute('rel') || '').toLowerCase();
      const needed = ['noopener', 'noreferrer'];
      const have = new Set(rel.split(/\s+/).filter(Boolean));
      needed.forEach(x => have.add(x));
      a.setAttribute('rel', Array.from(have).join(' '));
    }
  }

  // 给“按钮型 a”设置无跳转 href 与可访问性属性
  function makeButtonLike(a) {
    a.setAttribute('href', '#');
    a.setAttribute('role', 'button');
    a.setAttribute('tabindex', '0');
  }

  // 主题里常见功能的安全触发器（尽量不破坏原主题逻辑）
  function attachHandler(a) {
    const cls = a.classList;

    a.addEventListener('click', function (e) {
      // 对于我们人为补的 "#"，阻止默认跳转
      if ((a.getAttribute('href') || '') === '#') e.preventDefault();

      // 夜间模式
      if (cls.contains('darkmode_switchbutton')) {
        try {
          if (window.navFn?.switchDarkMode) return void window.navFn.switchDarkMode();
          if (window.navFn?.switcharMode)   return void window.navFn.switcharMode();
          if (window.heo?.switchDarkMode)   return void window.heo.switchDarkMode();
          if (window.switchDarkMode)        return void window.switchDarkMode();
        } catch (_) {}
        return;
      }

      // 侧栏/控制台/更多按钮等（尽量触发主题自带方法）
      if (cls.contains('asideSwitch')) {
        try { if (window.heo?.showConsole) return void window.heo.showConsole(); } catch (_) {}
        return;
      }

      if (cls.contains('console_switchbutton')) {
        try {
          if (window.heo?.showConsole) return void window.heo.showConsole();
          if (window.heo?.hideConsole) return void window.heo.hideConsole();
        } catch (_) {}
        return;
      }

      if (cls.contains('banner-button')) {
        // 交给主题自己处理；如果需要可在此触发弹层
        return;
      }

      // 评论弹幕开关（若主题暴露方法就调用）
      if (cls.contains('commentBarrage')) {
        try {
          if (window.switchCommentBarrage) return void window.switchCommentBarrage();
          if (window.heo?.toggleCommentBarrage) return void window.heo.toggleCommentBarrage();
        } catch (_) {}
        return;
      }

      // 返回顶部
      if (cls.contains('totopbtn')) {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
        return;
      }

      // 随机文章
      if (cls.contains('randomPost') || cls.contains('randomPost_button')) {
        try {
          if (window.toRandomPost) return void window.toRandomPost();
          // 兜底：如主题未暴露方法，可跳到归档页或随机一篇（这里选择归档）
          location.href = '/archives/';
        } catch (_) {}
        return;
      }

      // site-page 多为“站内页签”型 UI；不跳转
      if (cls.contains('site-page')) {
        // 交互由主题接管，这里只负责不跳走
        return;
      }
    });

    // 键盘可达性（回车触发）
    a.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (a.getAttribute('href') || '') === '#') {
        a.click();
      }
    });
  }

  function sanitizeOne(a) {
    const rawHref = (a.getAttribute('href') || '').trim().toLowerCase();
    const hasOnclick = !!a.getAttribute('onclick');

    // 1) target 安全强化
    hardenRel(a);

    // 2) 没有 href 或是无效 href
    const isInvalidHref = !rawHref || INVALID_HREFS.has(rawHref);

    // 3) 只有 onclick 的 a，也视作“无效跳转”
    if (isInvalidHref || hasOnclick) {
      // 若是“按钮型 a”，统一做成 button-like
      const isButtony = [...BUTTONY_CLASSES].some(c => a.classList.contains(c));

      if (isButtony) {
        makeButtonLike(a);
        attachHandler(a);
      } else {
        // 非按钮型但 href 无效：为了 SEO，让它最起码可抓取到**当前页**，
        // 又不破坏可能的 JS 行为。这里给一个“自指” href（#current）。
        // 如果确实需要可抓取到别的 URL，请在模板里改成真实 URL。
        if (isInvalidHref) a.setAttribute('href', '#current');
        // 保留 onclick，不额外阻止；以免破坏主题已有逻辑
      }
    }
  }

  function run() {
    document.querySelectorAll('a').forEach(sanitizeOne);
    // 懒加载/异步插入的新节点（PJAX/无限滚动）也处理
    const mo = new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(node => {
          if (node && node.nodeType === 1) {
            if (node.tagName === 'A') sanitizeOne(node);
            node.querySelectorAll && node.querySelectorAll('a').forEach(sanitizeOne);
          }
        });
      });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
