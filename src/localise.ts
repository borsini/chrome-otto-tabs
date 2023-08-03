// Adapted from https://stackoverflow.com/a/39810769

function replace_i18n(obj: Element, tag: String) {
    console.log("i18n", obj, tag)
    var msg = tag.replace(/__MSG_(\w+)__/g, function(match, v1) {
        return v1 ? chrome.i18n.getMessage(v1) : '';
    });

    if(msg != tag) obj.innerHTML = msg;
}

function localizeHtmlPage() {
    // Localize using __MSG_***__ data tags
    const data = document.querySelectorAll('[data-localize]');

    for (var i in data) if (data.hasOwnProperty(i)) {
        const obj = data[i];
        const tag = obj.getAttribute('data-localize')?.toString();

        if(tag != undefined) {
            replace_i18n(obj, tag)
        }
    }

    // Localize everything else by replacing all __MSG_***__ tags
    const page = document.getElementsByTagName('html');

    for (var j = 0; j < page.length; j++) {
        const obj = page[j];
        const tag = obj.innerHTML.toString();

        replace_i18n(obj, tag);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("Localizing)")
    localizeHtmlPage()
})