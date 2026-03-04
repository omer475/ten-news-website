import Foundation

struct ArticleService {
    private let client = APIClient.shared

    func fetchArticle(id: String) async throws -> ArticleDetailResponse {
        try await client.get(APIEndpoints.article(id: id))
    }
}
