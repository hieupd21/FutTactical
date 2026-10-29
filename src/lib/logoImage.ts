// Xử lý ảnh logo CLB người chơi tải lên: thu về khung vuông nhỏ để bản lưu không phình to.
const LOGO_SIZE = 256;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Đọc file ảnh, thu vào khung vuông 256px (giữ tỉ lệ, nền trong suốt) và trả về data URL PNG */
export async function readLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Tệp được chọn không phải ảnh.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Ảnh quá lớn (tối đa 8 MB).");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loadedImage = new Image();
      loadedImage.onload = () => resolve(loadedImage);
      loadedImage.onerror = () => reject(new Error("Không đọc được ảnh này."));
      loadedImage.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = LOGO_SIZE;
    canvas.height = LOGO_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
    const scale = Math.min(LOGO_SIZE / image.width, LOGO_SIZE / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    context.drawImage(
      image,
      (LOGO_SIZE - drawWidth) / 2,
      (LOGO_SIZE - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
