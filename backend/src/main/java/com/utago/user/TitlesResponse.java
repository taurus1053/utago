package com.utago.user;

import java.util.List;

public record TitlesResponse(
        List<TitleCategoryGroupResponse> categories,
        String equippedTitleCode,
        String equippedTitleName
) {
}
