import type { PromoMessage } from "@/types/promotions";

type TopPromoBarProps = {
  messages: PromoMessage[];
};

export function TopPromoBar({ messages }: TopPromoBarProps) {
  const intervalSeconds = 6;
  const totalDuration = messages.length * intervalSeconds;

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-white px-4 py-2 text-center text-xs font-semibold uppercase text-text">
      <div
        className="promo-rotator relative mx-auto flex h-4 max-w-full items-center justify-center overflow-hidden"
        style={
          {
            "--promo-duration": `${totalDuration}s`,
          } as React.CSSProperties
        }
      >
        {messages.map((message, index) => (
          <span
            className="promo-rotator-item absolute inset-x-0"
            key={message.id}
            style={
              {
                "--promo-delay": `${index * intervalSeconds}s`,
              } as React.CSSProperties
            }
          >
            {message.text}
          </span>
        ))}
      </div>
    </div>
  );
}
