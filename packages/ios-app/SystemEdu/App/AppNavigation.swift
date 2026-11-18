import SwiftUI

// Every push uses a value route. Register destinations once at each tab's root:
// mixing a view-destination catalog with value-destination courses loses that route.
enum AppRoute: Hashable {
    case catalog
    case course(ContentCourse)
    case activity(LearningActivity)
}

struct AppNavigationStack<Content: View>: View {
    @ObservedObject var store: LearningStore
    @ViewBuilder var content: () -> Content
    @State private var path: [AppRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            content().navigationDestination(for: AppRoute.self) { route in
                switch route {
                case .catalog: CatalogView(store: store)
                case .course(let course): CourseOutlineView(course: course, store: store)
                case .activity(let activity): ClassroomView(activity: activity, store: store)
                }
            }
        }
    }
}
