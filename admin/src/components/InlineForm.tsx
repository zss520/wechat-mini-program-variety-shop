import { Stack, StackProps } from "@mui/material";

/** 与 MUI size=small 的 outlined 输入框视觉高度对齐 */
export const INLINE_CONTROL_HEIGHT = 40;

/**
 * 一行查询/新建栏：输入框、下拉、日期、开关、按钮等高且垂直居中。
 * 避免默认 32px 按钮贴在 40px outlined 字段旁时错位。
 */
export default function InlineForm({ children, sx, ...rest }: StackProps) {
  const h = INLINE_CONTROL_HEIGHT;
  return (
    <Stack
      direction="row"
      spacing={1.5}
      useFlexGap
      flexWrap="wrap"
      alignItems="center"
      sx={{
        mb: 2,
        width: "100%",
        "& .MuiOutlinedInput-root": {
          height: h,
          boxSizing: "border-box",
        },
        "& .MuiOutlinedInput-input": {
          boxSizing: "border-box",
          height: "100%",
          py: 0,
          display: "flex",
          alignItems: "center",
        },
        "& input[type='datetime-local'], & input[type='date']": {
          minHeight: 0,
          lineHeight: "normal",
        },
        "& .MuiFormControl-root:has(input[type='datetime-local'])": { minWidth: { xs: 0, sm: 210 } },
        "& .MuiFormControl-root:has(input[type='date'])": { minWidth: { xs: 0, sm: 160 } },
        "& .MuiButton-root": {
          height: h,
          minHeight: h,
          py: 0,
        },
        "& .MuiFormControlLabel-root": {
          m: 0,
          height: h,
          alignItems: "center",
        },
        "& .MuiTextField-root, & .MuiFormControl-root": {
          maxWidth: "100%",
        },
        "@media (max-width:599.95px)": {
          "& .MuiTextField-root, & .MuiFormControl-root": {
            width: "100% !important",
            minWidth: "0 !important",
            flex: "1 1 100%",
          },
        },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Stack>
  );
}
