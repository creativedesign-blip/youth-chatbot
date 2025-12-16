import { useState, useEffect, useCallback, useRef } from "react";
import { LogOut, RefreshCw, Plus, Upload, X, Check, Image } from "lucide-react";
import { adminApi, HeroImage } from "../../services/adminApi";

interface HeroImageManagerProps {
  onLogout: () => void;
}

const MAX_IMAGES = 8;
const MIN_IMAGES = 1;

export function HeroImageManager({ onLogout }: HeroImageManagerProps) {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async (selectLast = false) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await adminApi.getHeroImages();
      if (result.success && result.images) {
        setImages(result.images);
        if (selectLast && result.images.length > 0) {
          // 選擇最後一張（用於新上傳後）
          setActiveTab(result.images.length - 1);
        } else if (result.images.length > 0) {
          // 確保 activeTab 不超出範圍
          setActiveTab(prev => Math.min(prev, result.images.length - 1));
        }
      } else {
        setError(result.error || "無法載入圖片");
      }
    } catch {
      setError("網路錯誤");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, []);

  // 清理 previewUrl 以防止 memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const currentImage = images[activeTab];
  const isNewSlot = activeTab >= images.length;
  const canAddMore = images.length < MAX_IMAGES;
  const canDelete = images.length > MIN_IMAGES;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("只支援 JPG、PNG、WebP 格式");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("檔案大小不能超過 5MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError("");

    try {
      const result = await adminApi.uploadImage(selectedFile, `輪播 ${images.length + 1}`);
      if (result.success) {
        // 清理預覽 URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        // 重新載入圖片並選擇最後一張
        await fetchImages(true);
      } else {
        setError(result.error || "上傳失敗");
      }
    } catch {
      setError("上傳失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReplaceImage = async () => {
    if (!selectedFile || !currentImage) return;

    setIsUploading(true);
    setError("");

    try {
      await adminApi.deleteImage(currentImage.id);
      const result = await adminApi.uploadImage(selectedFile, currentImage.alt_text || `輪播 ${activeTab + 1}`);
      if (result.success) {
        // 清理預覽 URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        await fetchImages();
      } else {
        setError(result.error || "替換失敗");
      }
    } catch {
      setError("替換失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentImage || !canDelete) return;

    if (!confirm("確定要刪除這張輪播圖嗎？")) return;

    setIsLoading(true);
    try {
      const result = await adminApi.deleteImage(currentImage.id);
      if (result.success) {
        await fetchImages();
        if (activeTab > 0) {
          setActiveTab(activeTab - 1);
        }
      } else {
        setError(result.error || "刪除失敗");
      }
    } catch {
      setError("刪除失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewSlot = () => {
    if (canAddMore) {
      setActiveTab(images.length);
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const cancelPreview = () => {
    // 清理預覽 URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (isNewSlot && images.length > 0) {
      setActiveTab(images.length - 1);
    }
  };

  const handleLogout = async () => {
    await adminApi.logout();
    onLogout();
  };

  const displayTabs = isNewSlot ? images.length + 1 : images.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              Hero Banner 管理
            </h1>
            <p className="text-xs text-gray-500">桃園市政府青年事務局</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchImages()}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full disabled:opacity-50"
              title="重新整理"
            >
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <LogOut size={16} />
              <span>登出</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
              <X size={16} />
            </button>
          </div>
        )}

        {/* 編輯標題 */}
        <div className="mb-4">
          <p className="text-orange-500 font-medium text-sm">
            正在編輯：輪播 {activeTab + 1} / {Math.max(displayTabs, 1)}
          </p>
        </div>

        {/* 主要內容區 - 左右佈局 */}
        <div className="flex gap-6">
          {/* 左側 - 輪播列表 */}
          <div className="flex-shrink-0" style={{ width: '140px' }}>
            <div className="space-y-1.5">
              {/* 現有圖片的 tabs */}
              {images.map((img, index) => {
                const isActive = activeTab === index;
                return (
                  <button
                    key={img.id}
                    onClick={() => {
                      setActiveTab(index);
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    style={{
                      backgroundColor: isActive ? '#f97316' : '#ffffff',
                      color: isActive ? '#ffffff' : '#374151',
                      border: isActive ? 'none' : '1px solid #e5e7eb',
                    }}
                    className="w-full px-2 py-2 rounded-md text-center transition-all shadow-sm hover:opacity-90"
                  >
                    <span className="font-medium text-xs">
                      輪播{index + 1}
                    </span>
                  </button>
                );
              })}

              {/* 新增 tab（如果正在新增） */}
              {isNewSlot && (
                <button
                  style={{
                    backgroundColor: '#f97316',
                    color: '#ffffff',
                  }}
                  className="w-full px-2 py-2 rounded-md text-center shadow-md"
                >
                  <span className="font-medium text-xs">輪播{images.length + 1}</span>
                </button>
              )}

              {/* 新增按鈕 */}
              {canAddMore && !isNewSlot && (
                <button
                  onClick={handleAddNewSlot}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#2563eb',
                    border: '2px dashed #93c5fd',
                  }}
                  className="w-full flex items-center justify-center px-2 py-2 rounded-md hover:bg-blue-50 transition-all"
                >
                  <Plus size={14} style={{ color: '#3b82f6' }} />
                </button>
              )}
            </div>

            {/* 圖片數量提示 */}
            <div className="mt-4 text-xs text-gray-400 text-center">
              {images.length} / {MAX_IMAGES} 張
            </div>
          </div>

          {/* 右側 - 圖片編輯區 */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border p-5">
              {/* 選擇圖片標題 */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="selectImage"
                  checked={true}
                  readOnly
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="selectImage" className="text-sm font-medium text-gray-700">
                  選擇圖片
                </label>
              </div>

              {/* 圖片預覽區 */}
              <div className="mb-5">
                {previewUrl ? (
                  <div className="relative group">
                    <img
                      src={previewUrl}
                      alt="預覽"
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <button
                        onClick={cancelPreview}
                        className="p-2 bg-white rounded-full shadow hover:bg-gray-100"
                      >
                        <X size={18} className="text-gray-700" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      新圖片預覽
                    </div>
                  </div>
                ) : currentImage && !isNewSlot ? (
                  <div className="relative group">
                    <img
                      src={currentImage.url}
                      alt={currentImage.alt_text || "輪播圖片"}
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      {currentImage.alt_text || `輪播 ${activeTab + 1}`}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-40 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2">
                    <Image size={32} className="text-gray-300" />
                    <p className="text-gray-400 text-sm">尚未選擇圖片</p>
                  </div>
                )}
              </div>

              {/* 上傳按鈕 */}
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="imageUpload"
                />

                <label
                  htmlFor="imageUpload"
                  className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-all"
                >
                  <Upload size={18} />
                  <span className="text-sm">上傳圖片</span>
                </label>

                {/* 格式說明 */}
                <div className="text-xs text-gray-400 space-y-0.5">
                  <p>• 圖片格式 JPG、JPEG、PNG</p>
                  <p>• 檔案最大不能超過 5 MB</p>
                </div>

                {/* 操作按鈕 */}
                {selectedFile && (
                  <div className="flex gap-2 pt-2">
                    {isNewSlot ? (
                      <button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
                      >
                        {isUploading ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                        <span>{isUploading ? "上傳中..." : "確認上傳"}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleReplaceImage}
                        disabled={isUploading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors text-sm font-medium"
                      >
                        {isUploading ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                        <span>{isUploading ? "替換中..." : "確認替換"}</span>
                      </button>
                    )}
                    <button
                      onClick={cancelPreview}
                      disabled={isUploading}
                      className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm"
                    >
                      取消
                    </button>
                  </div>
                )}

                {/* 刪除按鈕 */}
                {!isNewSlot && currentImage && canDelete && !selectedFile && (
                  <button
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="w-full py-2.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors text-sm"
                  >
                    刪除此輪播圖
                  </button>
                )}
              </div>
            </div>

            {/* 提示訊息 */}
            <div className="mt-4 text-xs text-gray-400 text-center">
              輪播圖會自動在首頁顯示，每 5 秒切換一次
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
