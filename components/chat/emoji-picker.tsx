"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SmileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmojiPickerProps {
  onChange: (value: string) => void;
}

// Simple emoji fallback for now
const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
  '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌'
];

export const EmojiPicker = ({ onChange }: EmojiPickerProps) => {
  // Using a simple fallback emoji picker to avoid emoji-mart v5 complexity
  // This provides a clean, functional emoji picker without runtime errors

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
          <SmileIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border-0">
        <div className="p-4">
          <div className="text-sm font-medium mb-3">Choose an emoji</div>
          <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
            {COMMON_EMOJIS.map((emoji, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-muted"
                onClick={() => onChange(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
