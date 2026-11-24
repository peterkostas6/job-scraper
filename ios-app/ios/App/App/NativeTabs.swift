import UIKit
import Capacitor

// The app's bottom tab bar is Apple's own UITabBar (system look, haptics, accessibility), laid
// over the web view. The site decides what each tab does: a tap is sent to the page as a
// "tabTap" event (index 0-4, same order as the site's .tabbar), and the page tells the bar which
// tab is selected and whether it should show at all (it's hidden during onboarding).

class MainViewController: CAPBridgeViewController, UITabBarDelegate {
    let tabBar = UITabBar()

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeTabsPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let navy = UIColor(red: 20 / 255, green: 33 / 255, blue: 61 / 255, alpha: 1)
        let cream = UIColor(red: 244 / 255, green: 237 / 255, blue: 224 / 255, alpha: 1)
        let coral = UIColor(red: 1, green: 107 / 255, blue: 91 / 255, alpha: 1)

        let look = UITabBarAppearance()
        look.configureWithDefaultBackground()
        look.backgroundColor = navy.withAlphaComponent(0.9)
        for layout in [look.stackedLayoutAppearance, look.inlineLayoutAppearance, look.compactInlineLayoutAppearance] {
            layout.normal.iconColor = cream.withAlphaComponent(0.6)
            layout.normal.titleTextAttributes = [.foregroundColor: cream.withAlphaComponent(0.6)]
            layout.selected.iconColor = coral
            layout.selected.titleTextAttributes = [.foregroundColor: coral]
        }
        tabBar.standardAppearance = look
        tabBar.scrollEdgeAppearance = look
        tabBar.tintColor = coral
        tabBar.overrideUserInterfaceStyle = .dark

        let tabs: [(String, String, String)] = [
            ("Jobs", "briefcase", "briefcase.fill"),
            ("Recent", "bolt", "bolt.fill"),
            ("Alerts", "bell", "bell.fill"),
            ("Saved", "bookmark", "bookmark.fill"),
            ("Request", "building.2", "building.2.fill"),
        ]
        tabBar.items = tabs.enumerated().map { i, t in
            UITabBarItem(title: t.0, image: UIImage(systemName: t.1), selectedImage: UIImage(systemName: t.2)).withTag(i)
        }
        tabBar.delegate = self
        tabBar.isHidden = true // the page shows it once it's on a screen with tabs

        tabBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tabBar)
        NSLayoutConstraint.activate([
            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        UISelectionFeedbackGenerator().selectionChanged()
        NativeTabsPlugin.current?.notifyListeners("tabTap", data: ["index": item.tag])
    }
}

private extension UITabBarItem {
    func withTag(_ tag: Int) -> UITabBarItem { self.tag = tag; return self }
}

@objc(NativeTabsPlugin)
public class NativeTabsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTabsPlugin"
    public let jsName = "NativeTabs"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "select", returnType: CAPPluginReturnPromise),
    ]
    static weak var current: NativeTabsPlugin?

    override public func load() { NativeTabsPlugin.current = self }

    private var bar: UITabBar? { (bridge?.viewController as? MainViewController)?.tabBar }

    @objc func setVisible(_ call: CAPPluginCall) {
        let visible = call.getBool("visible") ?? true
        DispatchQueue.main.async {
            self.bar?.isHidden = !visible
            call.resolve(["height": visible ? Double(self.bar?.frame.height ?? 0) : 0])
        }
    }

    // index -1 clears the selection.
    @objc func select(_ call: CAPPluginCall) {
        let index = call.getInt("index") ?? -1
        DispatchQueue.main.async {
            guard let bar = self.bar, let items = bar.items else { return call.resolve() }
            bar.selectedItem = index >= 0 && index < items.count ? items[index] : nil
            call.resolve()
        }
    }
}
