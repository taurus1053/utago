package com.utago.user;

import java.util.List;

public record TitleCategoryGroupResponse(
        String category,
        String categoryLabel,
        List<TitleItemResponse> titles
) {
}
