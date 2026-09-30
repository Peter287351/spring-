package com.demo.campus.common.result;

import lombok.AllArgsConstructor;
import lombok.Data;

/** 统一响应包装：所有接口返回 {code, message, data} */
@Data
@AllArgsConstructor
public class Result<T> {

    private int code;       // 0 成功，非 0 失败
    private String message;
    private T data;

    public static <T> Result<T> ok(T data) {
        return new Result<>(0, "success", data);
    }

    public static <T> Result<T> error(int code, String message) {
        return new Result<>(code, message, null);
    }
}
