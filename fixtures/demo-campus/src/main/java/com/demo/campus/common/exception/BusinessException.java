package com.demo.campus.common.exception;

import lombok.Getter;

/** 业务异常：由全局异常处理器转成 Result 返回 */
@Getter
public class BusinessException extends RuntimeException {

    private final int code;

    public BusinessException(String message) {
        this(400, message);
    }

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }
}
