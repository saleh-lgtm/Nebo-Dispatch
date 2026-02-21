"use client";

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface BaseInputProps {
    label?: string;
    error?: string;
    hint?: string;
    required?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

type InputProps = BaseInputProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = BaseInputProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const FormInput = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, hint, required, leftIcon, rightIcon, className = "", id, type, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);
        const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
        const isPassword = type === "password";
        const inputType = isPassword && showPassword ? "text" : type;

        return (
            <div className="form-group">
                {label && (
                    <label
                        htmlFor={inputId}
                        style={{
                            display: "block",
                            marginBottom: "0.5rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                        }}
                    >
                        {label}
                        {required && <span style={{ color: "var(--danger)", marginLeft: "0.25rem" }}>*</span>}
                    </label>
                )}
                <div style={{ position: "relative" }}>
                    {leftIcon && (
                        <span
                            style={{
                                position: "absolute",
                                left: "0.75rem",
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "var(--text-secondary)",
                                pointerEvents: "none",
                            }}
                        >
                            {leftIcon}
                        </span>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        type={inputType}
                        className={`input ${error ? "input-error" : ""} ${className}`}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                        style={{
                            paddingLeft: leftIcon ? "2.5rem" : undefined,
                            paddingRight: isPassword || rightIcon ? "2.5rem" : undefined,
                            borderColor: error ? "var(--danger)" : undefined,
                        }}
                        {...props}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: "absolute",
                                right: "0.75rem",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                padding: 0,
                            }}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    )}
                    {rightIcon && !isPassword && (
                        <span
                            style={{
                                position: "absolute",
                                right: "0.75rem",
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "var(--text-secondary)",
                                pointerEvents: "none",
                            }}
                        >
                            {rightIcon}
                        </span>
                    )}
                </div>
                {error && (
                    <p
                        id={`${inputId}-error`}
                        style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.25rem" }}
                        role="alert"
                    >
                        {error}
                    </p>
                )}
                {hint && !error && (
                    <p
                        id={`${inputId}-hint`}
                        style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.25rem" }}
                    >
                        {hint}
                    </p>
                )}
            </div>
        );
    }
);

FormInput.displayName = "FormInput";

export const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, hint, required, className = "", id, ...props }, ref) => {
        const textareaId = id || `textarea-${Math.random().toString(36).substring(2, 9)}`;

        return (
            <div className="form-group">
                {label && (
                    <label
                        htmlFor={textareaId}
                        style={{
                            display: "block",
                            marginBottom: "0.5rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                        }}
                    >
                        {label}
                        {required && <span style={{ color: "var(--danger)", marginLeft: "0.25rem" }}>*</span>}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={textareaId}
                    className={`input ${error ? "input-error" : ""} ${className}`}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
                    style={{
                        minHeight: "6rem",
                        resize: "vertical",
                        borderColor: error ? "var(--danger)" : undefined,
                    }}
                    {...props}
                />
                {error && (
                    <p
                        id={`${textareaId}-error`}
                        style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.25rem" }}
                        role="alert"
                    >
                        {error}
                    </p>
                )}
                {hint && !error && (
                    <p
                        id={`${textareaId}-hint`}
                        style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.25rem" }}
                    >
                        {hint}
                    </p>
                )}
            </div>
        );
    }
);

FormTextarea.displayName = "FormTextarea";

interface FormSelectProps extends BaseInputProps {
    options: { value: string; label: string }[];
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    placeholder?: string;
}

export function FormSelect({
    label,
    error,
    hint,
    required,
    options,
    placeholder,
    ...props
}: FormSelectProps) {
    const selectId = `select-${Math.random().toString(36).substring(2, 9)}`;

    return (
        <div className="form-group">
            {label && (
                <label
                    htmlFor={selectId}
                    style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                    }}
                >
                    {label}
                    {required && <span style={{ color: "var(--danger)", marginLeft: "0.25rem" }}>*</span>}
                </label>
            )}
            <select
                id={selectId}
                className={`input ${error ? "input-error" : ""}`}
                aria-invalid={!!error}
                style={{
                    cursor: "pointer",
                    borderColor: error ? "var(--danger)" : undefined,
                }}
                {...props}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && (
                <p
                    style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.25rem" }}
                    role="alert"
                >
                    {error}
                </p>
            )}
            {hint && !error && (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    {hint}
                </p>
            )}
        </div>
    );
}
