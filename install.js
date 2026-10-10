// ==================== 添加到手机桌面 ====================
// 安卓 Chrome / Edge：弹出系统安装框；iPhone、微信、其它浏览器：显示图文步骤。
const Install = (() => {
    let deferred = null;
    const ua = navigator.userAgent;
    const isWeChat = /MicroMessenger/i.test(ua);
    const isQQ = /\bQQ\//i.test(ua) && !isWeChat;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    function isStandalone() {
        return (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) || navigator.standalone === true;
    }

    function refreshButton() {
        const btn = document.getElementById('install-btn');
        if (btn) btn.classList.toggle('hidden', !isTouch || isStandalone());
    }

    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refreshButton(); });
    window.addEventListener('appinstalled', () => { deferred = null; refreshButton(); hide(); });

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
    }

    function steps() {
        if (isWeChat || isQQ) {
            return {
                title: '先用浏览器打开',
                lines: [
                    `${isWeChat ? '微信' : 'QQ'}里不能直接添加到桌面，请先：`,
                    '① 点右上角 <b>「…」</b>',
                    `② 选 <b>「在${isIOS ? ' Safari ' : '浏览器'}中打开」</b>`,
                    isIOS ? '③ 在 Safari 底部点 <b>分享按钮 ⬆</b> → <b>「添加到主屏幕」</b>' : '③ 在浏览器菜单里选 <b>「添加到桌面 / 主屏幕」</b>',
                ],
            };
        }
        if (isIOS) {
            return {
                title: '添加到主屏幕',
                lines: [
                    '① 用 <b>Safari</b> 打开本页',
                    '② 点屏幕底部（横屏时在顶部）的 <b>分享按钮 ⬆</b>',
                    '③ 往下找到 <b>「添加到主屏幕」</b>，点「添加」',
                    '之后从桌面图标打开，全屏无地址栏，玩起来更大更顺',
                ],
            };
        }
        return {
            title: '添加到桌面',
            lines: [
                '① 点浏览器的 <b>菜单按钮</b>（右上角 ⋮ 或底部 ≡）',
                '② 选 <b>「添加到桌面」</b> 或 <b>「添加到主屏幕 / 安装应用」</b>',
                '③ 如果手机提示「创建桌面快捷方式权限」，请允许',
                '之后从桌面图标打开，全屏无地址栏',
            ],
        };
    }

    async function prompt() {
        if (deferred) {
            const e = deferred; deferred = null;
            try { e.prompt(); await e.userChoice; } catch (err) { /* 用户取消 */ }
            refreshButton();
            return;
        }
        const s = steps();
        const box = document.getElementById('install-guide');
        if (!box) return;
        box.querySelector('.install-guide__title').textContent = s.title;
        box.querySelector('.install-guide__steps').innerHTML = s.lines.map(l => `<p>${l}</p>`).join('');
        box.classList.remove('hidden');
    }

    function hide() {
        const box = document.getElementById('install-guide');
        if (box) box.classList.add('hidden');
    }

    document.addEventListener('DOMContentLoaded', refreshButton);
    if (document.readyState !== 'loading') setTimeout(refreshButton, 0);

    return { prompt, hide, isStandalone };
})();
